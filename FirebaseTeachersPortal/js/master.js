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

function gernerateNewPaper(userId,papername){
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
                var ques = item.val().questions
                ques.forEach(snap =>{
                    lastPaperQuestion.push(snap.id)
                })
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
        questionDB.once('value', snap=>{
            snap.forEach(item=>{
                if(lastPaperQuestion.includes(item.key)){
                    if(lastPaperRatio[item.val().topic] === undefined){
                        lastPaperRatio[item.val().topic] = 1
                    }else{
                        lastPaperRatio[item.val().topic]++       
                    }
                }
            })
            
            let topicRatioCount = Object.values(lastPaperRatio)
            let topicRatioKey = Object.keys(lastPaperRatio)
            let paperQuestionCount = lastPaperQuestion.length
            
            let topicScoreSD = topicScoreArray.stanDeviate()
            while(topicScoreSD > (0.6 * paperQuestionCount)){
                topicScoreSD -= 1
            }
            topicScoreSD = Math.floor(topicScoreSD)
            
            if(topicScoreSD < 0.6){
                topicScoreSD = Math.random(2) 
            }

            let highRatio = Math.round(0.6 * paperQuestionCount)
            let midRatio = Math.round(0.4 * paperQuestionCount)
            let newPaperRatio = {};
            console.log(topicRatioCount.length)
            for(let i = 0; i<topicRatioCount.length; i++){
                if(topicRatioCount[i] >= highRatio){
                    if(goodTeirTopic.includes(topicRatioKey[i])){//high, good: decrease x2
                        newPaperRatio[topicRatioKey[i]] = Math.floor(lastPaperRatio[topicRatioKey[i]] - topicScoreSD)
                    }else if(midTeirTopic.includes(topicRatioKey[i])){//high, mid:  decrease or remain
                        var change = 0; 
                        (Math.random(1) === 0)? change = topicScoreSD: change = 0;
                        newPaperRatio[topicRatioKey[i]] = Math.floor(lastPaperRatio[topicRatioKey[i]] - change)
                    }else{//high, low:  remain or increase
                        var change = 0; 
                        (Math.random(1) === 0)? change = topicScoreSD: change = 0;
                        newPaperRatio[topicRatioKey[i]] = Math.floor(lastPaperRatio[topicRatioKey[i]] + change)
                    }
                    
                    
                }else if(topicRatioCount[i] >= midRatio){
                    //mid, good: decrease or remain
                    
                    //mid, mid:  decrease or remain
                    
                    //mid, low:  remain or increase
                    
                    if(goodTeirTopic.includes(topicRatioKey[i])){//high, good: decrease x2
                        newPaperRatio[topicRatioKey[i]] = Math.floor(lastPaperRatio[topicRatioKey[i]] - topicScoreSD/2)
                    }else if(midTeirTopic.includes(topicRatioKey[i])){//high, mid:  decrease or remain
                        var change = 0; 
                        (Math.random(1) === 0)? change = topicScoreSD: change = 0;
                        newPaperRatio[topicRatioKey[i]] = Math.floor(lastPaperRatio[topicRatioKey[i]] - change)
                    }else{//high, low:  remain or increase
                        var change = 0; 
                        (Math.random(topicScoreSD) === 0)? change = topicScoreSD: change = 1;
                        newPaperRatio[topicRatioKey[i]] = Math.floor(lastPaperRatio[topicRatioKey[i]] + change)
                    }
                    
                }else{
                    //low, good: decrease or remain
                    
                    //low, mid:  increase or remain
                    
                    //low, low:  increase x2
                    
                    if(goodTeirTopic.includes(topicRatioKey[i])){//high, good: decrease x2
                        newPaperRatio[topicRatioKey[i]] = Math.floor(lastPaperRatio[topicRatioKey[i]] - topicScoreSD/3)
                    }else if(midTeirTopic.includes(topicRatioKey[i])){//high, mid:  decrease or remain
                        var change = 0; 
                        (Math.random(1) === 0)? change = topicScoreSD: change = 0;
                        newPaperRatio[topicRatioKey[i]] = Math.floor(lastPaperRatio[topicRatioKey[i]] - change)
                    }else{//high, low:  remain or increase
                        var change = 0; 
                        (Math.random(topicScoreSD + 1) === 0)? change = topicScoreSD: change = 2;
                        newPaperRatio[topicRatioKey[i]] = Math.floor(lastPaperRatio[topicRatioKey[i]] + change)
                    }
                    
                }
                
            }
            //check if new ratio exceed limit
            //console.log(newPaperRatio)
            let checkQuestionSum = Object.values(newPaperRatio)
            let total = checkQuestionSum.reduce(function(total, num){
                return total + num;
            });
            let newPaperKeys = Object.keys(newPaperRatio)
            let exceed = total - paperQuestionCount
            let max = Math.max.apply(Math,checkQuestionSum)
            while(total>paperQuestionCount){
                for (let index = 0; index < exceed; index++) {
                    const element = newPaperRatio[newPaperKeys[index]];
                    if (element===max || element % 1 != 0) {
                        let newRatio = Math.floor(newPaperRatio[newPaperKeys[index]]) - 1
                        if (newRatio <= 0) {
                            newRatio = 1
                        }
                        newPaperRatio[newPaperKeys[index]] = newRatio
                        total = Object.values(newPaperRatio).reduce(function(total, num){
                            return total + num;
                        });
                        max = Math.max.apply(Math,Object.values(newPaperRatio))
                    }
                }
            }
            console.log(newPaperRatio)
            
            let questionBase = []
            //get questions from database seperated by topics
            questionDB.once('value', questions=>{
                questions.forEach(question =>{
                    //filter and remove questions assigned before
                    if(!pastQuestionIds.includes(question.key)){
                        if(questionBase[question.val().topic] === undefined)
                        questionBase[question.val().topic] = []
                        
                        let finalQuestion = question.val()
                        finalQuestion.id = question.key
                        questionBase[question.val().topic].push(finalQuestion)
                    }
                })
                
                let newPaperQuestion = []
                let newPTKeys = Object.keys(newPaperRatio)
                let newPTValues = Object.values(newPaperRatio)
                for(let i = 0; i<newPTKeys.length;i++){
                    var currentSelection = questionBase[newPTKeys[i]]
                    if(currentSelection !== undefined){
                        for(let x = 0; x<newPTValues[i];x++){
                            var index = Math.floor(Math.random()*currentSelection.length)
                            var randomItem = currentSelection[index]
                            newPaperQuestion.push(randomItem)
                            currentSelection.splice(index,1)
                            questionBase[newPTKeys[i]] = currentSelection
                        }
                        delete questionBase[newPTKeys[i]]
                    }
                }
                newPaperQuestion.forEach((item,index)=>{
                    if(item===undefined){
                        newPaperQuestion.splice(index,1)
                    }
                })
                //console.log(pastQuestionIds)
                //console.log(questionBase)
                //console.log(newPTKeys)
                // console.log(newPTValues.length)
                //console.log(questionBase)
                //prepare questions
                
                //check if fulfill homework requirement
                while(total < paperQuestionCount){
                    let short = paperQuestionCount - total
                    let remainTopics = Object.keys(questionBase)
                    for(let i = 0; i<short; i++){
                        var index = Math.floor(Math.random()*remainTopics.length)
                        var randomItem = remainTopics[index]
                        var currentSelection = questionBase[randomItem]
                        if(currentSelection !== undefined){
                            //console.log(randomItem)
                            var qindex = Math.floor(Math.random()*currentSelection.length)
                            var randomQ = currentSelection[qindex]
                            newPaperQuestion.push(randomQ)
                            total++
                            currentSelection.splice(index,1)
                            questionBase[randomItem] = currentSelection
                        }else{
                            i--
                        }
                    }
                }
                
                console.log(newPaperQuestion)
                var pushData = [];
                newPaperQuestion.forEach(item=>{
                    
                    pushData.push({
                        'id': item.id,
                        status:"",
                        stuAns:"",
                        tryCount:""
                    })
                })
                console.log(pushData)
                // firebase.database().ref('profile/'+userId+'/homework').push({
                //     status: "not completed",
                //     attempts: 0,
                //     name: papername,
                //     score: 0,
                //     totalScore: 100,
                //     questions: pushData
                // })
                
            })
        })
        
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