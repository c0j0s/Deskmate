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
        
function gernerateNewPaper(){
    let userDB = firebase.database().ref('profile/0001')
    userDB.once('value', snapshot=>{
        let userTopicScore = snapshot.val().topicScore
        let userPastQuestion = [];
        snapshot.child('homework').forEach(item =>{
            item.child('questions').forEach(question =>{
                userPastQuestion.push(question.val())
            })
        })
        let topicScoreArray = Object.values(userTopicScore)
        let topicScoreArrayKeys = Object.keys(userTopicScore)
        
        console.log(topicScoreArrayKeys)
        let min = Math.min.apply(Math,topicScoreArray);
        let max = Math.max.apply(Math,topicScoreArray);
        if(min === 0){
            min = 1;
        }
        console.log(min)
        for(let i = 0; i<topicScoreArray.length; i++){
            let score = topicScoreArray[i]/min
            console.log(score)
        }
        console.log(userTopicScore)
        console.log(userPastQuestion)
    })
}