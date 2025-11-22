// app.js (PRO v5) - FarmazonGymApp
// robust firebase init, appLib exposure, FG API (plans CRUD, trainer modes, weeks/trainings/exercises/series)
// Defensive: avoids duplicate declarations and waits for firebase availability.

(function(){
  // Firebase config (use your project values)
  const firebaseConfig = {
    apiKey: "AIzaSyBg8rTW2RM9EyNK-g-ZNOrinw4Z8bsf4oI",
    authDomain: "farmazongymapp.firebaseapp.com",
    projectId: "farmazongymapp",
    storageBucket: "farmazongymapp.appspot.com", // <-- corrected
    messagingSenderId: "1085154229236",
    appId: "1:1085154229236:web:9fb23eb327597a1",
    measurementId: "G-WP08FYQS4L"
  };

  // helpers
  function uid(pref='id'){ return pref+'_'+Math.random().toString(36).slice(2,9); }
  function esc(s){ if(s===null||s===undefined) return ''; return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function clone(o){ try{return JSON.parse(JSON.stringify(o));}catch(e){return o;} }
  function showToast(msg, timeout=3000){
    try{
      const t=document.createElement('div');
      t.textContent=msg;
      Object.assign(t.style,{position:'fixed',right:'18px',bottom:'18px',padding:'10px 14px',background:'linear-gradient(90deg,#06b6d4,#60a5fa)',color:'#012',borderRadius:'8px',zIndex:9999});
      document.body.appendChild(t); setTimeout(()=>t.remove(), timeout);
    }catch(e){ console.log(msg); }
  }

  // Wait until firebase object exists (in case scripts not fully parsed)
  function whenFirebaseReady(timeout = 5000){
    return new Promise((resolve, reject)=>{
      const start = Date.now();
      (function check(){
        if(window.firebase && window.firebase.apps !== undefined){
          return resolve();
        }
        if(Date.now() - start > timeout) return reject(new Error('Firebase not available'));
        setTimeout(check, 50);
      })();
    });
  }

  async function init(){
    try{
      await whenFirebaseReady();

      // initialize only once
      if(!firebase.apps.length){
        firebase.initializeApp(firebaseConfig);
      }

      // create appLib only if not present
      window.appLib = window.appLib || {};
      // prefer existing auth/db if someone else created it
      window.appLib.auth = window.appLib.auth || firebase.auth();
      window.appLib.db = window.appLib.db || firebase.firestore();
      window.appLib.uid = window.appLib.uid || uid;
      window.appLib.esc = window.appLib.esc || esc;
      window.appLib.clone = window.appLib.clone || clone;
      window.appLib.showToast = window.appLib.showToast || showToast;

      // Setup FG API (global app state & functions)
      window.FG = window.FG || {};
      const FG = window.FG;

      FG.state = FG.state || {
        currentUser: null, userDoc: null, plans: [], activePlanId: null, activeWeekId: null,
        unsubscribePlans: null, mode: 'user', viewingClientUid: null
      };

      const auth = window.appLib.auth;
      const db = window.appLib.db;

      // Subscribe to plans
      FG.subscribePlansForUid = function(uidToSubscribe){
        if(FG.state.unsubscribePlans){ FG.state.unsubscribePlans(); FG.state.unsubscribePlans = null; }
        if(!uidToSubscribe){ FG.state.plans=[]; FG.state.activePlanId=null; FG.state.activeWeekId=null; if(typeof window.renderAll==='function') window.renderAll(); return; }
        const col = db.collection('users').doc(uidToSubscribe).collection('plans').orderBy('createdAt','desc');
        FG.state.unsubscribePlans = col.onSnapshot(snap=>{
          const ps=[];
          snap.forEach(d=>{ const data=d.data(); data.id=d.id; ps.push(data); });
          FG.state.plans = ps;
          if(!FG.state.activePlanId && ps.length) FG.state.activePlanId = ps[0].id;
          const activePlan = FG.state.plans.find(p=>p.id===FG.state.activePlanId);
          if(activePlan && (!FG.state.activeWeekId || !((activePlan.weeks||[]).some(w=>w.id===FG.state.activeWeekId)))) {
            FG.state.activeWeekId = (activePlan.weeks && activePlan.weeks[0]) ? activePlan.weeks[0].id : null;
          }
          if(typeof window.renderAll==='function') window.renderAll();
        }, err=>{ console.error('subscribePlans error', err); showToast('Błąd ładowania planów: '+(err.message||err)); });
      };

      FG.subscribeMyPlans = function(){ FG.subscribePlansForUid(FG.state.currentUser?FG.state.currentUser.uid:null); };

      // CRUD operations
      FG.createPlan = async function(uidOwner, plan){ if(!uidOwner) throw new Error('No owner'); const p=clone(plan); p.id=p.id||uid('plan'); p.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection('users').doc(uidOwner).collection('plans').doc(p.id).set(p); return p.id; };
      FG.savePlan   = async function(uidOwner, plan){ if(!uidOwner) throw new Error('No owner'); const p=clone(plan); await db.collection('users').doc(uidOwner).collection('plans').doc(p.id).set(p, { merge:true }); };
      FG.deletePlan = async function(uidOwner, planId){ if(!uidOwner) throw new Error('No owner'); await db.collection('users').doc(uidOwner).collection('plans').doc(planId).delete(); };

      FG.addTrainingToPlan = async function(uidOwner, planId, title){
        const snap = await db.collection('users').doc(uidOwner).collection('plans').doc(planId).get();
        if(!snap.exists) throw new Error('Plan not found');
        const plan = snap.data(); plan.id = snap.id;
        plan.trainings = plan.trainings || [];
        const tr = { id: uid('tr'), title: title || 'Trening', exercises: [] };
        plan.trainings.push(tr);
        (plan.weeks||[]).forEach(w=>{ if(!w.data) w.data={ trainings: clone(plan.trainings) }; else w.data.trainings.push(clone(tr)); });
        await db.collection('users').doc(uidOwner).collection('plans').doc(plan.id).set(plan, { merge:true });
      };

      FG.addWeekToPlan = async function(uidOwner, planId, weekTitle){
        const snap = await db.collection('users').doc(uidOwner).collection('plans').doc(planId).get();
        if(!snap.exists) throw new Error('Plan not found');
        const plan = snap.data(); plan.id = snap.id; plan.weeks = plan.weeks || [];
        const wk = { id: uid('wk'), title: weekTitle || ('Tydzień '+(plan.weeks.length+1)), data: { trainings: clone(plan.trainings || []) } };
        plan.weeks.push(wk);
        await db.collection('users').doc(uidOwner).collection('plans').doc(plan.id).set(plan, { merge:true });
        return wk.id;
      };

      FG.addExerciseToWeek = async function(uidOwner, planId, weekId, trainingId, exerciseObj){
        const snap = await db.collection('users').doc(uidOwner).collection('plans').doc(planId).get();
        if(!snap.exists) throw new Error('Plan not found');
        const plan = snap.data(); plan.id = snap.id;
        const week = (plan.weeks||[]).find(w=>w.id===weekId); if(!week) throw new Error('Week not found');
        if(!week.data) week.data = { trainings: clone(plan.trainings || []) };
        const tr = (week.data.trainings||[]).find(t=>t.id===trainingId); if(!tr) throw new Error('Training not found');
        tr.exercises = tr.exercises || []; const ex = clone(exerciseObj); ex.id = ex.id || uid('ex'); tr.exercises.push(ex);
        await db.collection('users').doc(uidOwner).collection('plans').doc(plan.id).set(plan, { merge:true });
        return ex.id;
      };

      FG.editExerciseInWeek = async function(uidOwner, planId, weekId, trainingId, exerciseId, patch){
        const snap = await db.collection('users').doc(uidOwner).collection('plans').doc(planId).get(); if(!snap.exists) throw new Error('Plan not found');
        const plan = snap.data(); plan.id = snap.id;
        const week = (plan.weeks||[]).find(w=>w.id===weekId);
        const tr = (week.data.trainings||[]).find(t=>t.id===trainingId);
        const ex = (tr.exercises||[]).find(e=>e.id===exerciseId);
        Object.assign(ex, patch);
        await db.collection('users').doc(uidOwner).collection('plans').doc(plan.id).set(plan, { merge:true });
      };

      FG.deleteExerciseInWeek = async function(uidOwner, planId, weekId, trainingId, exerciseId){
        const snap = await db.collection('users').doc(uidOwner).collection('plans').doc(planId).get(); if(!snap.exists) throw new Error('Plan not found');
        const plan = snap.data(); plan.id = snap.id;
        const week = (plan.weeks||[]).find(w=>w.id===weekId);
        const tr = (week.data.trainings||[]).find(t=>t.id===trainingId);
        tr.exercises = (tr.exercises||[]).filter(e=>e.id!==exerciseId);
        await db.collection('users').doc(uidOwner).collection('plans').doc(plan.id).set(plan, { merge:true });
      };

      FG.addSeries = async function(uidOwner, planId, weekId, trainingId, exerciseId, seriesObj){
        const snap = await db.collection('users').doc(uidOwner).collection('plans').doc(planId).get(); const plan = snap.data(); plan.id = snap.id;
        const week = (plan.weeks||[]).find(w=>w.id===weekId);
        const tr = (week.data.trainings||[]).find(t=>t.id===trainingId);
        const ex = (tr.exercises||[]).find(e=>e.id===exerciseId);
        ex.series = ex.series || []; seriesObj.id = seriesObj.id || uid('s'); ex.series.push(seriesObj);
        await db.collection('users').doc(uidOwner).collection('plans').doc(plan.id).set(plan, { merge:true });
        return seriesObj.id;
      };
      FG.deleteSeries = async function(uidOwner, planId, weekId, trainingId, exerciseId, seriesId){
        const snap = await db.collection('users').doc(uidOwner).collection('plans').doc(planId).get(); const plan = snap.data(); plan.id = snap.id;
        const week = (plan.weeks||[]).find(w=>w.id===weekId);
        const tr = (week.data.trainings||[]).find(t=>t.id===trainingId);
        const ex = (tr.exercises||[]).find(e=>e.id===exerciseId);
        ex.series = (ex.series||[]).filter(s=>s.id!==seriesId);
        await db.collection('users').doc(uidOwner).collection('plans').doc(plan.id).set(plan, { merge:true });
      };

      FG.oneRm = { epley:(w,r)=> w*(1+r/30), brzycki:(w,r)=> w*(36/(37-r)), lombardi:(w,r)=> w*Math.pow(r,0.1) };

      FG.setMode = async function(mode){ FG.state.mode = mode; if(mode==='user'){ if(FG.state.currentUser) FG.subscribePlansForUid(FG.state.currentUser.uid); } else if(mode==='trainer' || mode==='trainer-self'){ if(FG.state.currentUser) FG.subscribePlansForUid(FG.state.currentUser.uid); } if(typeof window.renderAll==='function') window.renderAll(); };
      FG.trainerOpenClient = async function(clientUid){ if(!FG.state.currentUser) throw new Error('Nie zalogowany'); const myDoc = await db.collection('users').doc(FG.state.currentUser.uid).get(); if(!myDoc.exists || myDoc.data().role!=='trainer') throw new Error('Brak praw trenera'); FG.subscribePlansForUid(clientUid); FG.state.viewingClientUid = clientUid; FG.state.mode='trainer'; if(typeof window.renderAll==='function') window.renderAll(); };

      FG.expandAll = function(container){ container = container || document; container.querySelectorAll('details').forEach(d=>d.open=true); };
      FG.collapseAll = function(container){ container = container || document; container.querySelectorAll('details').forEach(d=>d.open=false); };

      FG.debug = function(){ console.log('FG.state', FG.state); };

      // auth listener — populate user doc and subscribe
      auth.onAuthStateChanged(async user=>{
        FG.state.currentUser = user || null;
        FG.state.userDoc = null;
        if(user){
          try{
            const uref = db.collection('users').doc(user.uid);
            const snap = await uref.get();
            if(!snap.exists) await uref.set({ email:user.email, role:'user', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            FG.state.userDoc = (await uref.get()).data();
          }catch(e){ console.error(e); }
          FG.subscribePlansForUid(user.uid);
        } else {
          if(FG.state.unsubscribePlans){ FG.state.unsubscribePlans(); FG.state.unsubscribePlans = null; }
          FG.state.plans=[]; FG.state.activePlanId=null; FG.state.activeWeekId=null; FG.state.viewingClientUid=null;
          if(typeof window.renderAll==='function') window.renderAll();
        }
      });

      window.FG = FG;
      window.appLib = window.appLib || {};
      window.appLib.auth = auth;
      window.appLib.db = db;
      window.appLib.uid = uid;
      window.appLib.esc = esc;
      window.appLib.clone = clone;
      window.appLib.showToast = showToast;

      console.log('FarmazonGymApp app.js v5 initialized');
    }catch(err){
      console.error('app.js init error:', err);
      // show small visible error for debugging
      document.addEventListener('DOMContentLoaded', ()=>{ try{ const e=document.createElement('div'); e.textContent='App init error: '+(err.message||err); Object.assign(e.style,{position:'fixed',left:8,top:8,zIndex:99999,background:'#ffd',padding:'6px',border:'1px solid #c00'}); document.body.appendChild(e); }catch(e){} });
    }
  }

  // run init async
  init();
})();
