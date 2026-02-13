import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDZgqBp63YG4xfPqF-ybNadcuBSbMr1OGg",
  authDomain: "otpverify-b111e.firebaseapp.com",
  projectId: "otpverify-b111e",
  storageBucket: "otpverify-b111e.firebasestorage.app",
  messagingSenderId: "876556500941",
  appId: "1:876556500941:web:b09de6def8067685944e84",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const firebaseCompat = firebase;