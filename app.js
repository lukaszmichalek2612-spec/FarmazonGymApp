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
  const auth=firebase.auth(); const db=firebase.firestore();
  function uid(p='id'){return p+'_'+Math.random().toString(36).slice(2,9);}
  function esc(s){if(s===null||s===undefined)return'';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function clone(o){return JSON.parse(JSON.stringify(o));}
  function showToast(msg,ms=2400){try{const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),ms);}catch(e){alert(msg);}}
  async function ensureUserDoc(uid,email){const ref=db.collection('users').doc(uid);const snap=await ref.get();if(!snap.exists) await ref.set({email,role:'user',createdAt:firebase.firestore.FieldValue.serverTimestamp()});}
  async function getUserRole(uid){const s=await db.collection('users').doc(uid).get();return s.exists?(s.data().role||null):null;}
  async function register(email,pass){const c=await auth.createUserWithEmailAndPassword(email,pass);await ensureUserDoc(c.user.uid,email);return c.user;}
  async function login(email,pass){return auth.signInWithEmailAndPassword(email,pass);}
  async function logout(){return auth.signOut();}

  function subscribePlans(userId,cb){
    return db.collection('users').doc(userId).collection('plans').orderBy('createdAt','desc')
      .onSnapshot(snap=>{const plans=[];snap.forEach(d=>{const data=d.data();data.id=d.id;plans.push(data);});cb(plans);},
      err=>{console.error(err);showToast('Błąd planów');});
  }
  async function createPlan(userId,plan){const p=clone(plan);p.createdAt=firebase.firestore.FieldValue.serverTimestamp();const id=p.id||uid('plan');p.id=id;await db.collection('users').doc(userId).collection('plans').doc(id).set(p);return id;}
  async function savePlan(userId,plan){const p=clone(plan);await db.collection('users').doc(userId).collection('plans').doc(p.id).set(p,{merge:true});}
  const _t=new Map();
  async function autosave(userId,plan,delay=650){return new Promise((res,rej)=>{const k=userId+'::'+plan.id;if(_t.has(k))clearTimeout(_t.get(k));_t.set(k,setTimeout(async()=>{try{await savePlan(userId,plan);res(true);}catch(e){rej(e);}},delay));});}
  async function deletePlan(userId,planId){await db.collection('users').doc(userId).collection('plans').doc(planId).delete();}
  function ensureWeekData(plan,week){if(!week.data)week.data={trainings:clone(plan.trainings||[])};if(!week.data.trainings)week.data.trainings=clone(plan.trainings||[]);}

  // Library
  async function upsertLibraryExercise(userId,ex){
    const name=String(ex.name||'').trim(); if(!name) throw new Error('Brak nazwy');
    const q=await db.collection('users').doc(userId).collection('library').where('name','==',name).limit(1).get();
    const now=firebase.firestore.FieldValue.serverTimestamp();
    if(q.empty) await db.collection('users').doc(userId).collection('library').add({name,favorite:!!ex.favorite,updatedAt:now});
    else await q.docs[0].ref.set({name,favorite: ex.favorite===undefined ? (q.docs[0].data().favorite||false) : !!ex.favorite,updatedAt:now},{merge:true});
  }
  async function fetchLibrary(userId){
    const snap=await db.collection('users').doc(userId).collection('library').orderBy('updatedAt','desc').limit(500).get();
    const out=[]; snap.forEach(d=>{const data=d.data();out.push({id:d.id,name:data.name,favorite:!!data.favorite,updatedAtText:data.updatedAt&&data.updatedAt.toDate?data.updatedAt.toDate().toISOString().slice(0,10):''});});
    return out;
  }
  function subscribeLibrary(userId,cb){
    return db.collection('users').doc(userId).collection('library').orderBy('updatedAt','desc').limit(500)
      .onSnapshot(snap=>{const out=[];snap.forEach(d=>{const data=d.data();out.push({id:d.id,name:data.name,favorite:!!data.favorite,updatedAtText:data.updatedAt&&data.updatedAt.toDate?data.updatedAt.toDate().toISOString().slice(0,10):''});});cb(out);});
  }
  async function deleteLibraryExercise(userId,docId){await db.collection('users').doc(userId).collection('library').doc(docId).delete();}

  // Logs
  async function addWorkoutLog(userId,log){const ref=db.collection('users').doc(userId).collection('workouts').doc();const payload=clone(log);payload.id=ref.id;await ref.set(payload);return ref.id;}
  async function fetchWorkoutLogs(userId,fromISO,toISO,limitN=80){
    const snap=await db.collection('users').doc(userId).collection('workouts')
      .where('date','>=',fromISO).where('date','<=',toISO).orderBy('date','desc').limit(limitN).get();
    const out=[]; snap.forEach(d=>{const data=d.data();data.id=d.id;out.push(data);}); return out;
  }
  async function deleteWorkoutLog(userId,logId){await db.collection('users').doc(userId).collection('workouts').doc(logId).delete();}

  function _num(x){const n=Number(x);return isFinite(n)?n:0;}
  const oneRm={epley:(w,r)=>_num(w)*(1+_num(r)/30),brzycki:(w,r)=>_num(w)*(36/(37-_num(r))),lombardi:(w,r)=>_num(w)*Math.pow(_num(r),0.1)};
  function calcExerciseVolume(ex){return (ex.series||[]).reduce((s,a)=>s+_num(a.weight)*_num(a.reps),0);}
  function calcTrainingVolume(tr){return (tr.exercises||[]).reduce((s,ex)=>s+calcExerciseVolume(ex),0);}
  function calcLogVolume(log){return (log.entries||[]).reduce((s,e)=>s+_num(e.weight)*_num(e.reps),0);}
  async function fetchExerciseProgress(userId,exerciseName,daysBack=365){
    const to=new Date(); const from=new Date(); from.setDate(from.getDate()-daysBack);
    const fromISO=from.toISOString().slice(0,10), toISO=to.toISOString().slice(0,10);
    const logs=await fetchWorkoutLogs(userId,fromISO,toISO,200);
    const best=new Map();
    logs.forEach(l=>{(l.entries||[]).forEach(e=>{if(String(e.exercise||'')!==String(exerciseName||''))return;const v=oneRm.epley(e.weight,e.reps);const k=l.date;best.set(k,Math.max(best.get(k)||0,v));});});
    return [...best.entries()].map(([date,value])=>({date,value})).sort((a,b)=>a.date.localeCompare(b.date));
  }

  window.appLib={auth,db,uid,esc,clone,showToast,ensureUserDoc,getUserRole,register,login,logout,
    subscribePlans,createPlan,savePlan,autosave,deletePlan,ensureWeekData,
    upsertLibraryExercise,fetchLibrary,subscribeLibrary,deleteLibraryExercise,
    addWorkoutLog,fetchWorkoutLogs,deleteWorkoutLog,fetchExerciseProgress,
    oneRm,calcExerciseVolume,calcTrainingVolume,calcLogVolume
  };
})();