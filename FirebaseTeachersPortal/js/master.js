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
    let questionDB = firebase.database().ref('question')
    userDB.once('value', snapshot=>{
        let userTopicScore = snapshot.val().topicScore
        let userPastQuestion = []
        let lastPaperQuestion = []
        let lastPaperTopics = []
        var pastQuestionIds = []

        //get questions assigned
        snapshot.child('homework').forEach(item =>{
            item.child('questions').forEach(question =>{
                //get questions properties
                userPastQuestion.push(question.val())
                //get question Ids
                pastQuestionIds.push(question.val().id)
            })
            if(item.val().attempts > 0){
                //get last paper question
                lastPaperQuestion = []
                lastPaperQuestion = item.val().questions
            }
        })

        let topicScoreArray = Object.values(userTopicScore)
        let topicScoreArrayKeys = Object.keys(userTopicScore)
        
        //get max and min of topic score
        let min = Math.min.apply(Math,topicScoreArray);
        let max = Math.max.apply(Math,topicScoreArray);

        //determine topics teirs
        let goodTeirCutOff = 0.8 * max
        let midTeirCutOff= 0.5 * max

        let goodTeirTopic = [], midTeirTopic = [], lowTeirTopic = []

        //sort topics into respective teirs
        for(let i = 0; i<topicScoreArray.length; i++){
            if(topicScoreArray[i] >= goodTeirCutOff){
                goodTeirTopic.push(topicScoreArrayKeys[i])
            }else if(topicScoreArray[i] >= midTeirCutOff){
                midTeirTopic.push(topicScoreArrayKeys[i])
            }else{
                lowTeirTopic.push(topicScoreArrayKeys[i])
            }
        }
        let lastPaperRatio = {}

        //get last paper ration
        lastPaperQuestion.forEach(question =>{
            questionDB.orderByKey().startAt(question.id).endAt(question.id).limitToLast(1).once('value',snap=>{
                let topic = Object.values(snap.val())[0].topic
                lastPaperTopics.push(topic)
                if(lastPaperRatio[topic] === undefined){
                    lastPaperRatio[topic] = 1
                }else{
                    lastPaperRatio[topic]++
                }
            })
        })

        let topicRatioCount = Object.values(lastPaperRatio)
        let topicRatioKey = Object.keys(lastPaperRatio)
        let paperQuestionCount = lastPaperQuestion.length

        let topicScoreSD = topicScoreArray.stanDeviate()
        while(topicScoreSD > (0.6 * paperQuestionCount)){
            topicScoreSD -= 1
        }
        topicScoreSD = Math.floor(topicScoreSD)
        
        let highRatio = Math.round(0.6 * paperQuestionCount)
        let midRatio = Math.round(0.4 * paperQuestionCount)
        let newPaperRatio;

        for(let i = 0; i<topicRatioCount.length; i++){
            if(topicRatioCount[i] >= highRatio){
                //high, good: decrease x2

                //high, mid:  decrease or remain

                //high, low:  remain or increase

            }else if(topicRatioCount[i] >= midRatio){
                //mid, good: decrease or remain

                //mid, mid:  decrease or remain

                //mid, low:  remain or increase

            }else{
                //low, good: decrease or remain

                //low, mid:  increase or remain

                //low, low:  increase x2

            }
        }
        console.log(highRatio)
        console.log(midRatio)
        console.log(topicScoreSD)

        //use new ratio to get questions

        var questionBase = {}
        var pastQuestionIds = []
        userPastQuestion.forEach(item=>{
            pastQuestionIds.push(item.id)
        })

        //get questions from database seperated by topics
        questionDB.once('value', questions=>{
            questions.forEach(question =>{
                //filter and remove questions assigned before
                if(!pastQuestionIds.includes(question.key)){
                    if(questionBase[question.val().topic] === undefined)
                        questionBase[question.val().topic] = []
                    else
                        questionBase[question.val().topic].push(question.val())
                }
            })
        })
        console.log(pastQuestionIds)
        console.log(questionBase)

        //prepare questions
        
        //check if fulfill homework requirement
    })
}

//function to calculate standard deviation
Array.prototype.stanDeviate = function(){
    var i,j,total = 0, mean = 0, diffSqredArr = [];
    for(i=0;i<this.length;i+=1){
        total+=this[i];
    }
    mean = total/this.length;
    for(j=0;j<this.length;j+=1){
        diffSqredArr.push(Math.pow((this[j]-mean),2));
    }
    return (Math.sqrt(diffSqredArr.reduce(function(firstEl, nextEl){
             return firstEl + nextEl;
           })/this.length));
 };