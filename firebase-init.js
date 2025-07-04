// firebase-init.js

const firebaseConfig = {
  apiKey: "AIzaSyBcYaoL8koHfhH3zKWak-LK-lmIVDPcATA",
  authDomain: "food-order-app-81395.firebaseapp.com",
  databaseURL: "https://food-order-app-81395-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "food-order-app-81395",
  storageBucket: "food-order-app-81395.appspot.com",
  messagingSenderId: "783633241181",
  appId: "1:783633241181:web:cc87ee429f1b9ca5fae9b4",
  measurementId: "G-MN6B7MF4HZ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
