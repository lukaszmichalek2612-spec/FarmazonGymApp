// FarmazonGymApp — TOP appLib (vanilla + Firebase compat)
(function(){
  const firebaseConfig = {
  "apiKey": "AIzaSyBg8rTW2RM9EyNK-g-ZNOrinw4Z8bsf4oI",
  "authDomain": "farmazongymapp.firebaseapp.com",
  "projectId": "farmazongymapp",
  "storageBucket": "farmazongymapp.firebasestorage.app",
  "messagingSenderId": "1085154229236",
  "appId": "1:1085154229236:web:9fb23eb327b477367597a1",
  "measurementId": "G-WP08FYQS4L"
};
  if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();
  const db = firebase.firestore();

  function uid(pref='id'){ return pref+'_'+Math.random().toString(36).slice(2,9); }
  function esc(s){ if(s===null||s===undefined) return ''; return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  function showToast(msg, timeout=2600){
    try{
      const t = document.createElement('div');
      t.className='toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(()=>t.remove(), timeout);
    }catch(e){ alert(msg); }
  }

  async function ensureUserDoc(uid, email){
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if(!snap.exists){
      await ref.set({ email, role:'user', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  }

  async function getUserRole(uid){
    const snap = await db.collection('users').doc(uid).get();
    if(!snap.exists) return null;
    return (snap.data().role || null);
  }

  async function register(email, pass){
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await ensureUserDoc(cred.user.uid, email);
    return cred.user;
  }

  async function login(email, pass){ return auth.signInWithEmailAndPassword(email, pass); }
  async function logout(){ return auth.signOut(); }

  function subscribePlans(userId, cb){
    return db.collection('users').doc(userId).collection('plans')
      .orderBy('createdAt','desc')
      .onSnapshot(snap=>{
        const plans=[];
        snap.forEach(d=>{ const data=d.data(); data.id=d.id; plans.push(data); });
        cb(plans);
      }, err=>{
        console.error(err);
        showToast('Błąd ładowania planów: ' + (err.message||String(err)));
      });
  }

  async function createPlan(userId, plan){
    const p = clone(plan);
    p.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const docId = p.id || uid('plan');
    p.id = docId;
    await db.collection('users').doc(userId).collection('plans').doc(docId).set(p);
    return docId;
  }

  async function savePlan(userId, plan){
    const p = clone(plan);
    await db.collection('users').doc(userId).collection('plans').doc(p.id).set(p, { merge:true });
  }

  const _autosaveTimers = new Map();
  async function autosave(userId, plan, delay=900){
    return new Promise((resolve,reject)=>{
      const key = userId + '::' + plan.id;
      if(_autosaveTimers.has(key)) clearTimeout(_autosaveTimers.get(key));
      const t = setTimeout(async ()=>{
        try{ await savePlan(userId, plan); resolve(true); }
        catch(e){ reject(e); }
      }, delay);
      _autosaveTimers.set(key, t);
    });
  }

  async function deletePlan(userId, planId){
    await db.collection('users').doc(userId).collection('plans').doc(planId).delete();
  }

  function ensureWeekData(plan, week){
    if(!week.data) week.data = { trainings: clone(plan.trainings || []) };
    if(!week.data.trainings) week.data.trainings = clone(plan.trainings || []);
  }

  function _num(x){ const n = Number(x); return isFinite(n) ? n : 0; }

  function calcExerciseVolume(ex){
    const series = ex.series || [];
    return series.reduce((sum,s)=> sum + _num(s.weight)*_num(s.reps), 0);
  }
  function calcTrainingVolume(tr){
    return (tr.exercises||[]).reduce((sum,ex)=> sum + calcExerciseVolume(ex), 0);
  }
  function calcWeekStats(week){
    let volume=0, exCount=0, doneSets=0, allSets=0;
    (week.data?.trainings||[]).forEach(tr=>{
      (tr.exercises||[]).forEach(ex=>{
        exCount++;
        const series = ex.series||[];
        allSets += series.length;
        doneSets += series.filter(s=>!!s.done).length;
        volume += series.reduce((sum,s)=> sum + _num(s.weight)*_num(s.reps), 0);
      });
    });
    return { volume, exCount, doneSets, allSets };
  }

  const oneRm = {
    epley: (w,r)=> _num(w) * (1 + _num(r)/30),
    brzycki: (w,r)=> _num(w) * (36 / (37 - _num(r))),
    lombardi: (w,r)=> _num(w) * Math.pow(_num(r), 0.1)
  };

  window.appLib = {
    auth, db,
    uid, esc, clone,
    showToast,
    ensureUserDoc, getUserRole,
    register, login, logout,
    subscribePlans, createPlan, savePlan, autosave, deletePlan,
    ensureWeekData,
    calcExerciseVolume, calcTrainingVolume, calcWeekStats,
    oneRm
  };
})();
