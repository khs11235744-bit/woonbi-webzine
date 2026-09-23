// Run ONLY by the project owner on a trusted machine with Application Default Credentials.
// Requires firebase-admin installed locally. No credential contents are printed.
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
const project=value('--project'),email=value('--email');
if(!args.includes('--confirm')||!/^woonbi-[a-z0-9-]{3,35}$/.test(project||'')||project.includes('indie')||!email?.includes('@'))throw new Error('Use --project woonbi-... --email owner@school --confirm. Never use an INDI+P project.');
const app=initializeApp({credential:applicationDefault(),projectId:project});
const u=await getAuth(app).getUserByEmail(email);
if(!u.emailVerified)throw new Error('Teacher must first sign in using verified Google login.');
const db=getFirestore(app),ref=db.doc(`members/${u.uid}`),snap=await ref.get();
if(!snap.exists())throw new Error('First sign in to the new webzine to create a pending membership.');
await ref.update({role:'teacher',active:true});
console.log('Teacher membership approved in isolated project:',project);
