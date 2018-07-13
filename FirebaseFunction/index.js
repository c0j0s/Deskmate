'use strict';

/*
BUGS:
move on issue, question number resets after moving on
*/
const natural = require('natural');
const ObjValues = require('object.values');
const {dialogflow} = require('actions-on-google');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const userDB = admin.database().ref('/profile/0001')
const homeworkDB = admin.database().ref('/profile/0001/homework');
const questionDB = admin.database().ref('/question');
const messageDB = admin.database().ref('/messages');
const feedbackDB = admin.database().ref('/feedback');

const app = dialogflow({debug: false});

const WELCOME_INTENT = 'Default Welcome Intent';
const FALLBACK_INTENT = 'Default Fallback Intent';

const GET_HOMEWORKS = 'Get Homeworks';

const BEGIN_HOMEWORK_INTENT = 'Begin Homework Session';
const START_HOMEWORK_ON_QUESTION_INTENT = 'Start specific paper and question';

const CHANGE_HOMEWORK_INTENT = 'Change Homework';
const CHANGE_HOMEWORK_YES_INTENT = 'Change Homework - yes';

const BEGIN_QUESTION_ONE_INTENT = 'Begin Question - Start Question 1';
const BEGIN_QUESTION_OTHER_INTENT = 'Begin Question - Start Other Question';

const CHECK_ANSWER_INTENT = 'Check Student Answer';
const CHECK_ANSWER_NEXT = 'Check Student Answer - next';

const ASK_ANYTHING_INTENT = 'Ask Anything';//NIL

const GET_MESSAGES = 'Get My Messages';
const READ_MESSAGES_YES = 'Get My Messages - yes';
const REPLY_MESSAGES = 'Get My Messages - yes - reply';
const CONFIRM_REPLY = 'Get My Messages - yes - reply - yes';

const SEND_MESSAGES = 'Send Message';
const CONFIRM_SEND = 'Send Message - yes';

const GET_FEEDBACK = 'Get Feedback'
const READ_FEEDBACK_YES = 'Get Feedback - yes'

const END_SESSION = 'End Session'

const FAQ_SCHOOL = 'FAQ_SCHOOL - custom'

const {WebhookClient} = require('dialogflow-fulfillment');
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });
    console.log('DialogflowBody: ' + JSON.stringify(request.body));
    const param = request.body.result.parameters;
    
    //============================================================================================================================================
    // INTENT METHODS
    //============================================================================================================================================
    
    function welcomeUser(agent){
        return new Promise(resolve => {
            userDB.once('value',snapshot=>{
                messageDB.orderByChild('to').equalTo('0001').once('value', messages =>{
                    var messageCount = 0;
                    messages.forEach(item =>{
                        console.log(item)
                        if(item.val().read === false){
                            messageCount++
                        }
                    })
                var hwCount = 0
                var vals = Object.keys(snapshot.child('homework').val()).map(key=> {
                    return snapshot.child('homework').val()[key];
                });
                vals.forEach(element => {
                    if(element.attempts ===0){
                        hwCount++
                    }
                });
                var id = snapshot.key
                snapshot = snapshot.val()
                snapshot.key = id;
                console.log(messageCount)
                snapshot.messageCount = messageCount;
                snapshot.hwCount = hwCount;
                resolve(snapshot);
                })
            })
        }).then(snapshot =>{
            console.log('userlogin key:' + snapshot.key)
            const context = {
                'name': 'user', 
                'lifespan': 30, 
                'parameters': snapshot
            };
            agent.setContext(context)
            let speech = `Welcome back ${snapshot.name}. `;
            if(snapshot.messageCount === 0 && snapshot.hwCount === 0){
                speech = speech + `you have no new notifications. `
            }else{
                speech = speech + `you have `
                if(snapshot.hwCount !== 0){
                    speech = speech + `${snapshot.hwCount} new homework `
                }
                if(snapshot.hwCount !== 0 && snapshot.messageCount !== 0){
                    speech = speech + 'and '
                }
                if(snapshot.messageCount !== 0){
                    speech = speech + `${snapshot.messageCount} new message `
                }
                speech = speech + `. `
            }
            speech = speech + `what would you like to do now?`
            return agent.add(speech)
        }).catch(error => {
            console.log(error)
            return agent.add(`Welcome back.`)
        });
    }

    function getUserHomeworks(agent){
        return new Promise(resolve => {
            var listOfPaper = {
                completed: [],
                notCompleted: []
            }
            homeworkDB.once('value',snapshot=>{
                snapshot.forEach(paper =>{
                    paper = paper.val();
                    if(paper.attempts === 0){
                        listOfPaper.notCompleted.push(paper.name)
                    }else{
                        listOfPaper.completed.push(paper.name)
                    }
                })
                resolve(listOfPaper)
            })
        }).then(listOfPaper =>{
            var speech;
            if(listOfPaper.notCompleted.length !== 0){
                speech = `Currently you have ${listOfPaper.notCompleted.length} incomplete homework, they are `
                listOfPaper.notCompleted.forEach((item,index) => {
                    if(listOfPaper.notCompleted.length === 1){
                        speech = speech + item + '.'
                    }else if((listOfPaper.notCompleted.length - 1) === index){
                        speech = speech.slice(0, -2);
                        speech = speech + ' and ' + item + '.'
                    }else{
                        speech = speech + item + ', '
                    }
                })
            }else{
                speech = `Currently you have no new homework.`
            }
            console.log(speech)
            return agent.add(speech)
        }).catch(error => {
            console.log(error)
            return agent.add(`Sorry, i couldn't find your homework.`)
        });
    }

    function beginHomeworkSession(agent){
        agent.clearContext('getmymessages-followup')
        var paperName = param.paperName;
        var paperNum = param.paperNum;
        paperName = paperName + ' ' + paperNum
        var speech = `Hang on, searching for ${paperName}.`;
        return getPaper(agent, paperName).
        then(paperparam => {
            if(paperparam === false){       
                return agent.add(speech + ` Sorry, I couldn't find ${paperName} . Please try again.`);
            }else{
                console.log('paper attempts: ' + paperparam.attempts)
                if(paperparam.attempts === 0){
                    speech = speech + ` Ok, found ${paperparam.name}. Would you like to start on question 1?`;
                }else{
                    speech = speech + ` Ok, found ${paperparam.name}. You have previously attempted this paper, do you want to redo this paper from question 1 again?`;
                }
                return agent.add(speech);
            }
        })
    }

    function changeHomework(agent){
        var paperName = param.paperName;
        var speech = `Hang on, searching for paper ${paperName}.`;
        return getPaper(agent, paperName).
        then(paperparam => {
            if(paperparam === false){       
                return agent.add(speech + ` Sorry, I couldn't find paper ${paperName} . Please try again.`);
            }else{
                console.log('paper attempts: ' + paperparam.attempts)
                if(paperparam.attempts === 0){
                    speech = speech + ` Ok, found ${paperparam.name}. Would you like to start on this paper?`;
                }else{
                    speech = speech + ` Ok, found ${paperparam.name}. You have previously attempted this paper, do you want to redo this paper again?`;
                }
                return agent.add(speech);
            }
        })
    }

    function confirmChangeHomework(agent){
        return beginQuestion(agent)
    }

    function beginQuestion(agent) {
        var questionNumber = param.questionNumber;
        param.questionNumber = ""
        console.log('parampaperNo: ' + param.questionNumber)
        var paperName = param.paperName;
        if(questionNumber === ""){
            questionNumber = 1;
        }
        console.log('questionNumber:' + questionNumber)
        return getFBQuestions(agent,questionNumber)
        .then(currentQuestion => {
            if(currentQuestion === false){
                return agent.add(`Sorry, I couldn't find question ${questionNumber} . Please try again.`);
            }else{
                agent.clearContext('checkanswercontext')
                const context = {
                    'name': 'checkanswercontext', 
                    'lifespan': 5, 
                    'parameters': {
                        'questionTryCount' : 0,
                        'preQuestionNumber' : 0,
                        'questionNumber': questionNumber,
                        'questionAnswerStatus': "",
                        'score': 0
                    }
                };
                agent.setContext(context)
                console.log('paperkey: ' + agent.getContext('paper').parameters.key)
                agent.clearContext('paperstats')
                const paperStatscontext = {
                    'name': 'paperstats', 
                    'lifespan': 30, 
                    'parameters': {
                        'paperkey' : agent.getContext('paper').parameters.key,
                        'startTime': new Date(),
                        'endTime': ''
                    }
                };
                agent.setContext(paperStatscontext)
                console.log('currentQuestion: ' + currentQuestion)
                return agent.add(formQuestion(questionNumber,currentQuestion));
            }
        }).catch(error => {
            return agent.add("Error occured " + error);
        });
    }
    
    function checkStudentAnswer(agent){
        var paper = agent.getContext('paper').parameters;
        var paperQuestions = paper.questions;
        var answer = param.inputAnswer;
        var selection = ['A','B','C','D']
        console.log(answer)
        console.log(selection.includes(answer))
        if(!selection.includes(answer)){
            return agent.add(`Sorry, i didn't get your answer, please try again.`)
        }
        var currentQuestion = agent.getContext('currentquestion').parameters;
        var checkAnswerContext = agent.getContext('checkanswercontext').parameters;
        var speech, postData;

        //update previous question number
        checkAnswerContext.preQuestionNumber = checkAnswerContext.questionNumber;

        //check student answer with firebase answer
        if(answer === currentQuestion.answer.toUpperCase()){
            speech = `Answer correct! Moving on to the next question. `;
            checkAnswerContext.questionAnswerStatus = "correct";
            
            //update total score if only question correct for first try
            if(checkAnswerContext.questionTryCount === 0){
                if(currentQuestion.marks===undefined){
                    currentQuestion.marks = 20
                }
                checkAnswerContext.score = checkAnswerContext.score + currentQuestion.marks;
                //update try count to the topic scores
                updateTopicScore(currentQuestion)
            }
            
            //update question number to proceed to next question
            checkAnswerContext.questionNumber++;

        }else{
            speech = `Answer incorrect! try again? `;
            checkAnswerContext.questionAnswerStatus  = "wrong";
        }
        
        if(checkAnswerContext.questionNumber === checkAnswerContext.preQuestionNumber){
            //update try count if redo question
            checkAnswerContext.questionTryCount++;
        }
        
        //question data to update 
        postData = {
            status: checkAnswerContext.questionAnswerStatus,
            stuAns: answer,
            tryCount: checkAnswerContext.questionTryCount
        }
        updateQuestionScore(postData,paper.key, checkAnswerContext.preQuestionNumber);
        
        if(checkAnswerContext.questionNumber <= Object.keys(paperQuestions).length){
            if(checkAnswerContext.questionAnswerStatus === "correct"){
                
                //reset the try count when proccedding to the next question
                checkAnswerContext.questionTryCount = 0;                
            }
            agent.clearContext('checkanswercontext')
            const context = {
                'name': 'checkanswercontext', 
                'lifespan': 5, 
                'parameters': checkAnswerContext
            };
            agent.setContext(context)
            return getFBQuestions(agent,checkAnswerContext.questionNumber)
            .then(currentQuestion => {
                //read next question if answer correct
                if(checkAnswerContext.questionTryCount === 0){
                    speech = speech + formQuestion(checkAnswerContext.questionNumber,currentQuestion);
                }
                return agent.add(speech);
            });
        }else{
            let paperStats = agent.getContext('paperstats').parameters
            paperStats.endTime = new Date();
            updateSessionStats(paperStats)
            agent.clearContext('paperstats')
            console.log('paper score:' + checkAnswerContext.score)
            updatePaperProperties(paper.key,checkAnswerContext.score,paper.attempts + 1);
            return agent.add("Answer correct! Reach the end of paper, you have score " + checkAnswerContext.score + " marks out of " +paper.totalScore + ' What would you like to do next?');
        }
    }

    //Not implemented
    function checkStudentAnswerNext(agent){
        var paper = agent.getContext('paper').parameters;
        var paperQuestions = paper.questions;
        var answer = param.inputAnswer;
        var selection = ['A','B','C','D']
        console.log(answer)
        console.log(selection.includes(answer))
        if(!selection.includes(answer)){
            return agent.add(`Sorry, i didn't get your answer, please try again.`)
        }
        var checkAnswerContext = agent.getContext('checkanswercontext').parameters;
        var speech;
        var change = true;
        var questionNumber = param.moveTo;
        console.log('moving on: ' + questionNumber)

        //update previous question number
        checkAnswerContext.preQuestionNumber = checkAnswerContext.questionNumber;
        speech = `Ok, Moving on to the next question. `;
        if(questionNumber === ''){
            checkAnswerContext.questionNumber++;
        }else{
            if(checkAnswerContext.questionNumber >= questionNumber){
                speech = `Sorry please choose a question after current question`;
                change = false;
            }else{
                checkAnswerContext.questionNumber = questionNumber;
            }
        }

        if(change){
            if(checkAnswerContext.questionNumber <= Object.keys(paperQuestions).length){
                console.log('next qyestion: ' + checkAnswerContext.questionNumber)
                return getFBQuestions(agent,checkAnswerContext.questionNumber)
                .then(currentQuestion => {
                    return agent.add(speech + formQuestion(checkAnswerContext.questionNumber,currentQuestion));
                });
            }else{
                updatePaperProperties(paper.key,checkAnswerContext.score,paper.attempts + 1);
                return agent.add("Answer correct! Reach the end of paper, you have score " + checkAnswerContext.score + " marks out of " +paper.totalScore);
            }
        }else{
            agent.add(speech)
        }
    }

    function getMessages(agent){
        agent.clearContext('paper')
        agent.clearContext('sendmessage-followup')
        var userID = '0001';
        var senderName = param.senderName;

        return getUserMessages(userID,senderName).then(userMessageList => {
            var speech;
            var senderName = param.senderName;
            if(userMessageList.length > 0){
                speech = `You have ${userMessageList.length} new messages`
                if(senderName !== ''){
                    speech = speech + ` from ${senderName}`
                }
                speech = speech + `, do you want me to read the message?`
            }else{
                speech = `you have no new messages`
                if(senderName !== ''){
                    speech = speech + ` from ${senderName}`
                }
            }

            agent.clearContext('getmymessages-followup')
            const context = {
                'name': 'getmymessages-followup', 
                'lifespan': userMessageList.length, 
                'parameters': {
                    'messagelist' : userMessageList
                }
            };
            agent.setContext(context)

            return agent.add(speech)
        }).catch(error=>{
            console.log(error)
            return agent.add('please try again')
        })
    }

    function readMessages(agent){
        agent.clearContext('paper')
        var messageNumber = param.messageNumber
        if(messageNumber === ''){
            messageNumber = 1
        }
        var message = agent.getContext('getmymessages-followup').parameters.messagelist
        var speech = '';
        speech = speech + 'Message ' + (messageNumber) + ': ' + message[messageNumber - 1].message.senderName + ' say ' + message[messageNumber - 1].message.message + '. ';
        updateMessageReadStatus(message[messageNumber - 1].id);
        
        agent.clearContext('getmymessages-yes-followup')
        const context = {
            'name': 'getmymessages-yes-followup', 
            'lifespan': 5, 
            'parameters': {
                'messageTo' : message[messageNumber - 1]
            }
        };
        agent.setContext(context)
        console.log('reading message:' + speech)
        return agent.add(speech);
    }

    function replyMessage(agent){
        agent.clearContext('paper');
        if(agent.getContext('user') === null){
            return agent.add('User Session Ended')
        }
        var user = agent.getContext('user').parameters;
        

        var replyToMessage = agent.getContext('getmymessages-yes-followup').parameters.messageTo

        var messageBody = param.contentBody;
        var data = {
            'datetime': new Date(),
            'from': user.key,
            'message': messageBody,
            'read': false,
            'recipientName': replyToMessage.message.senderName,
            'replyTo': replyToMessage.id,
            'senderName': user.name,
            'to': replyToMessage.message.from
        }
        agent.clearContext('sendmessage-followup')
        const context = {
            'name':'sendmessage-followup',
            'lifespan':2,
            'parameters': data
        }
        agent.setContext(context)
        return agent.add('Ok, you are replying to ' + replyToMessage.message.senderName + '. confirm?')
    }

    function sendMessage(agent){
        agent.clearContext('paper');
        if(agent.getContext('user') === null){
            return agent.add('User Session Ended')
        }
        var user = agent.getContext('user').parameters;
        var sendTo = param.sendTo;
        var recipient = {};

        recipient.tId = '';

        for(var teacher in user.teacherList){
            if (user.teacherList.hasOwnProperty(teacher)) {
                if(user.teacherList[teacher].name.toLowerCase() === sendTo.toLowerCase()){
                    recipient = user.teacherList[teacher]
                }
            }
        }
        if(recipient.tId === ''){
            return agent.add('Sorry i cant find ' + param.sendTo + ' in your contact list, please try again' )
        }

        var messageBody = param.contentBody;
        var data = {
            'datetime': new Date(),
            'from': user.key,
            'message': messageBody,
            'read': false,
            'recipientName': recipient.sal + ' ' + recipient.name,
            'replyTo': "",
            'senderName': user.name,
            'to': recipient.tId
        }
        agent.clearContext('sendmessage-followup')
        const context = {
            'name':'sendmessage-followup',
            'lifespan':2,
            'parameters': data
        }
        agent.setContext(context)
        return agent.add('Ok, you are sending a message to your '+ recipient.subject +' teacher '+ recipient.sal + ' ' + recipient.name + '. confirm?')
    }

    function confirmSendMessage(agent){
        agent.clearContext('paper');
        var data = agent.getContext('sendmessage-followup').parameters;
        delete data['contentBody.original']
        delete data['sendTo.original']
        delete data['contentBody']
        delete data['sendTo']
        console.log(data)
        messageDB.push(data)
        return agent.add('Ok, message sent. what would you like to do next?')
    }

    function getFeedback(agent){
        agent.clearContext('paper')
        agent.clearContext('sendmessage-followup')
        agent.clearContext('getmymessages-yes-followup')

        if(agent.getContext('user') === null){
            return agent.add('User Session Ended')
        }
        const user = agent.getContext('user').parameters;
        return getUserFeedback(user.key).then(feedbackList => {
            var speech
            if(feedbackList.length !== 0){
                speech = `you have ${ feedbackList.length } feedback from you teachers, do you want me to read it out for you?`
            }else{
                speech = `you have no new feedback`
            }

            agent.clearContext('getfeedback-followup')
            const context = {
                'name':'getfeedback-followup',
                'lifespan':feedbackList.length,
                'parameters': {
                    'list': feedbackList
                }
            }
            console.log("length: " + feedbackList.length)
            agent.setContext(context)
            return agent.add(speech)
        }).catch(error=>{
            console.log(error)
            return agent.add('please try again')
        })
    }

    function readFeedback(agent){
        //to handle the feedback selection [not implemented]
        let feedbackNumber = param.feedbackNumber;
        agent.clearContext('paper')
        agent.clearContext('sendmessage-followup')
        agent.clearContext('getmymessages-yes-followup')

        let feedbackList = agent.getContext('getfeedback-followup').parameters.list
        console.log(feedbackList)
        agent.clearContext('getfeedback-followup')
        //retrieve and read all the feedbacks
        updateFeedbackReadStatus(feedbackList[0].key)
        return agent.add(`Feedback 1 from ${feedbackList[0].teacherName}: he said ${feedbackList[0].feedback}`)
    }

    function endSession(agent){
        agent.clearContext('paper')
        agent.clearContext('sendmessage-followup')
        agent.clearContext('getmymessages-yes-followup')
        agent.clearContext("checkanswercontext")
        agent.clearContext("currentquestion")
        agent.clearContext("paperstats")
        agent.clearContext("doingquestion")
        agent.clearContext("checkstudentanswer-followup")
        console.log('Session Ended: context cleared')
        return agent.add('end_session')
    }

    function defaultFallback(agent){
        agent.add('fall back: intent not implemented')
    }
    //============================================================================================================================================
    // GENERIC METHODS
    //============================================================================================================================================
    
    //retrieving paper details from firebase
    const getPaper = (agent, paperName) => new Promise(resolve => {
        agent.clearContext("checkanswercontext")
        agent.clearContext("paper")
        agent.clearContext("currentquestion")
        agent.clearContext("paperstats")
        agent.clearContext("doingquestion")
        agent.clearContext("checkstudentanswer-followup")
        var paperparam = false;
        homeworkDB.once('value',snapshot=>{
            snapshot.forEach(snap => {
                if(snap.val().name.toLowerCase().includes(paperName.toLowerCase())){
                    paperparam = snap.val();
                    paperparam.key = snap.key;
                    const context = {
                        'name': 'paper', 
                        'lifespan': 30, 
                        'parameters': paperparam,
                    };
                    agent.setContext(context);
                }
            })
            resolve(paperparam);
        })
    });

    //retrieving question details from firebase
    const getFBQuestions = (agent, questionNumber) => new Promise(
        resolve => {
            var paper = agent.getContext('paper').parameters;
            var paperQuestions = paper.questions;
            console.log('paperQuestions: ' + paperQuestions)
            if(questionNumber <= Object.keys(paperQuestions).length){
                return questionDB.once('value', snap => {
                    agent.clearContext('currentQuestion');
                    var currentQuestion = snap.child(paperQuestions[questionNumber-1].id).val();
                    const context = {
                        'name': 'currentQuestion', 
                        'lifespan': 5, 
                        'parameters': snap.child(paperQuestions[questionNumber-1].id).val()
                    };
                    agent.setContext(context)
                    resolve(currentQuestion);
                });
            }else{
                return resolve(false);
            }
        }
    );

    //generate question speech format
    function formQuestion(questionNumber,currentQuestion) {
        const speech = `
        Question ${questionNumber}:  ${currentQuestion.question}
        A :  ${currentQuestion.a}.
        B :  ${currentQuestion.b}.
        C :  ${currentQuestion.c}.
        D :  ${currentQuestion.d}.
        What is your option?
        `;
        console.log('questionSpeech: ' + speech)
        return speech;
    }

    //for updating the status of each individual questions
    function updateQuestionScore(postData, paperkey, questionNumber){
        var hwref = homeworkDB.child(paperkey + "/questions/" + (questionNumber - 1));
        hwref.update(postData);
    }

    //for updating the topic scores
    function updateTopicScore(currentQuestion){
        if(agent.getContext('user') === null){
            return agent.add('User Session Ended')
        }
        var user = agent.getContext('user').parameters;
        var topic = currentQuestion.topic;
        var newScore;
        if(typeof(user.topicScore[topic]) === 'undefined'){
            newScore =  1;
        }else{
            newScore = user.topicScore[topic] + 1;
        }
        user.topicScore[topic] = newScore;
        //update context value to match database
        const context = {
            'name': 'user', 
            'lifespan': 30, 
            'parameters': user,
        };
        agent.setContext(context);
        
        console.log('new topic score: '+ newScore)
        //post to database
        userDB.child('topicScore').update({
            [topic]:newScore
        })
    }

    //for updating the status of paper
    function updatePaperProperties(paperkey,score,paperAttempts){
        homeworkDB.child(paperkey).update({
            score: score,
            attempts: paperAttempts + 1,
            status: "completed",
            datetimeCompleted: new Date()
        })
    }

    //update message status
    function updateMessageReadStatus(key){
        console.log('update message status: ' + key)
        messageDB.child(key).update({
            'read': true
        })
    }

    //fot retrieving users messages
    const getUserMessages = (userID,senderName) => new Promise(resolve =>{
        console.log('function trigged 5')
            var userMessageList = [];
            var content = {}
            messageDB.once('value', snap =>{
                snap.forEach(message =>{
                    var key = message.key;
                    message = message.val()
                    if(message.to === userID){
                        if(message.read === false){
                            if(senderName !== ''){
                                if(message.senderName.toLowerCase().includes(senderName.toLowerCase())){
                                    content = {
                                        'id': key,
                                        'message':message
                                    }
                                    userMessageList.push(content)
                                }
                            }else{
                            content = {
                                'id': key,
                                'message':message
                            }
                            userMessageList.push(content)
                            }
                        }
                    }
                })
                resolve(userMessageList)
            })
    })

    const getUserFeedback = (userkey) => new Promise(resolve=>{
        feedbackDB.orderByChild('sId').equalTo(userkey).once('value', allFeedback=>{
            var feedbackList = [];
            allFeedback.forEach(feedback => {
                if(feedback.val().read === false){
                    let item = feedback.val()
                    item.key = feedback.key
                    feedbackList.push(item)
                }
            })
            console.log(feedbackList)
            resolve(feedbackList)
        })
    })

    //update feedback status
    function updateFeedbackReadStatus(key){
        console.log('update feedback status: ' + key)
        feedbackDB.child(key).update({
            'read': true
        })
    }

    //update homework session stats
    function updateSessionStats(Stats){
        Stats.duration = new Date(Stats.endTime) - new Date(Stats.startTime)
        console.log(Stats)
        homeworkDB.child(Stats.paperkey).child('sessionStats').update({
            'startTime':Stats.startTime,
            'endTime':Stats.endTime,
            'duration':Stats.duration
        })
    }

    //[DEPRECIATED] for clearing the salutation in sendors name
    function clearSal(rawText){
        var sals = ['mr', 'ms', 'mrs', 'mdm', 'dr'];
        var result = {};

        sals.forEach((item,index) => {
            if (new RegExp("\\b"+item+"\\b").test(rawText)) {
                console.log(item + ' ' + rawText)
                result.sal = item
                result.name = rawText.replace(item, '')
            } 
        })
        console.log(result)
        return result
    }
    
    //============================================================================================================================================
    // CXA Functions
    //============================================================================================================================================

    let faqDB = admin.database().ref('/faq');

    function queryFaq(agent){
        //clear context
        clearContext(agent)

        //get question
        let keywords = param.keyword;
        let newStr = []
        console.log('queryFaq: ' + keywords)
        keywords.forEach((text,index) => {
            if(text.includes(' ')){
                console.log("spliting: "+text.split(' '))
                let arr = text.split(' ')
                for(let x of arr){
                    newStr.push(x)
                }
            }else{
                newStr.push(text)
            }
        })
        console.log('queryFaq: SPLIT: ' + newStr)

        let result = {}
        return faqDB.once('value', snap=>{
            for(let kw of newStr){
            //keywords.forEach(kw => {
                console.log(kw)
                snap.forEach(faq =>{
                    if(!faq.val().answer === undefined || !faq.val().answer === ''){
                        
                    
                    if(faq.val().tags !== undefined){
                        if(ObjValues(faq.val().tags).toString().toLowerCase().includes(kw.toLowerCase())){
                            if(result[faq.key] === undefined){
                                result[faq.key] = {}
                                result[faq.key].id = faq.key
                                result[faq.key].answer = faq.val().answer
                                result[faq.key].confident = 1
                            }else{
                                result[faq.key].confident++
                            }
                        }
                    }
                    if(faq.val().question !== undefined){
                        if(faq.val().question.toLowerCase().includes(kw.toLowerCase())){ 
                            if(result[faq.key] === undefined){
                                    result[faq.key] = {}
                                    result[faq.key].id = faq.key
                                    result[faq.key].answer = faq.val().answer
                                    result[faq.key].confident = 0.4
                                }else{
                                    result[faq.key].confident =+ 0.4
                            }
                        }else{
                            if(result[faq.key] === undefined){
                                result[faq.key] = {}
                                result[faq.key].id = faq.key
                                result[faq.key].answer = faq.val().answer
                                result[faq.key].confident = 0
                            }else{
                                result[faq.key].confident =- 0.1
                        }
                        }
                    }
                    if(faq.val().answer !== undefined){
                        if(faq.val().answer.toLowerCase().includes(kw.toLowerCase())){
                            if(result[faq.key] === undefined){
                                result[faq.key] = {}
                                result[faq.key].id = faq.key
                                result[faq.key].answer = faq.val().answer
                                result[faq.key].confident = 0.1
                            }else{
                                result[faq.key].confident =+ 0.1
                            }
                        }
                    }else{
                        if(!result[faq.key] === undefined){
                            delete result[faq.key]
                        }
                    }
                    }
                })
            //})
            
        }
            console.log(result)
            let resultValues = ObjValues(result)
            let max = 0;
            let response = '';
            resultValues.forEach(item =>{
                if(item.confident > max){
                    max = item.confident
                    response = item.answer
                }
            })
            if(response === ''){
                response = 'Sorry, I dun have a answer for you question. I will continue my learning to provide better service next time.'
                addNewFaq(agent,newStr)
            }
            console.log(response)
            let conv = agent.conv();
            //conv.ask(new Suggestions(`Not what I'm looking for.`))
            conv.ask(response);
            return agent.add(conv);
        })
    }

    function faqNotFound(agent){
        let conv = agent.conv();
        conv.ask(`Ok, i'll feedback to the customer service team`);
        agent.add(conv)
    }
    function addNewFaq(agent,tags){
        let question = request.body.result.resolvedQuery
        console.log(question)
        var filterlist = ['i','for','the','should','is','are','shall','then']
        tags = tags.filter(f => !filterlist.toLowerCase().includes(f.toLowerCase()));
        console.log(tags)
        let ftag = {}
        tags.forEach((item,index)=>{
            ftag[index] = {}
            ftag[index] = item
        })
        console.log(ftag)
        faqDB.push({
            'question': question,
            'tags': ftag
        })
    }

    function clearContext(agent){
        agent.clearContext("checkanswercontext")
        agent.clearContext("paper")
        agent.clearContext("currentquestion")
        agent.clearContext("paperstats")
        agent.clearContext("doingquestion")
        agent.clearContext("checkstudentanswer-followup")
    }

    //============================================================================================================================================
    // INTENT FUNCTION MAPPING
    //============================================================================================================================================

    let intentMap = new Map();
    intentMap.set(WELCOME_INTENT, welcomeUser)
    intentMap.set(BEGIN_HOMEWORK_INTENT, beginHomeworkSession);

    intentMap.set(GET_HOMEWORKS, getUserHomeworks)

    intentMap.set(CHANGE_HOMEWORK_INTENT, changeHomework);
    intentMap.set(CHANGE_HOMEWORK_YES_INTENT, confirmChangeHomework);
    intentMap.set(START_HOMEWORK_ON_QUESTION_INTENT, defaultFallback);

    intentMap.set(BEGIN_QUESTION_ONE_INTENT, beginQuestion);
    intentMap.set(BEGIN_QUESTION_OTHER_INTENT, beginQuestion);

    intentMap.set(CHECK_ANSWER_INTENT, checkStudentAnswer);
    intentMap.set(CHECK_ANSWER_NEXT, checkStudentAnswerNext);

    intentMap.set(GET_MESSAGES, getMessages);
    intentMap.set(READ_MESSAGES_YES, readMessages);
    intentMap.set(REPLY_MESSAGES, replyMessage)
    intentMap.set(CONFIRM_REPLY,confirmSendMessage)

    intentMap.set(SEND_MESSAGES, sendMessage);
    intentMap.set(CONFIRM_SEND, confirmSendMessage);

    intentMap.set(GET_FEEDBACK,getFeedback)
    intentMap.set(READ_FEEDBACK_YES,readFeedback)

    intentMap.set(END_SESSION,endSession)

    intentMap.set(FAQ_SCHOOL,queryFaq)
    intentMap.set('FAQ_SCHOOL_NOT_FOUND',faqNotFound)

    agent.handleRequest(intentMap);
});
