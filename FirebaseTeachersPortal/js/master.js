var config = {
    apiKey: "AIzaSyB29exuhOXpePNSnW4UaGd8dhSppgYbYTo",
    authDomain: "deskmate2018.firebaseapp.com",
    databaseURL: "https://deskmate2018.firebaseio.com",
    projectId: "deskmate2018",
    storageBucket: "deskmate2018.appspot.com",
    messagingSenderId: "876434687063"
};
var firebase = firebase.initializeApp(config);

function formatDate(dbDate){
    var d = new Date(dbDate)
    var r = d.getFullYear() +'/' + d.getMonth() +'/' +d.getDate() + " " + d.getHours() + ":" + d.getSeconds();
    return r;
}
		