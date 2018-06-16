'use strict';

/*
BUGS:
move on issue, question number resets after moving on
*/

const {dialogflow} = require('actions-on-google');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const userDB = admin.database().ref('/profile/0001')
const homeworkDB = admin.database().ref('/profile/0001/homework');
const questionDB = admin.database().ref('/question');
const messageDB = admin.database().ref('/messages');

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

const {WebhookClient} = require('dialogflow-fulfillment');
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
    let conv = agent.conv();
    
    const param = request.body.result.parameters;
    
    //============================================================================================================================================
    // INTENT METHODS
    //============================================================================================================================================
    
    function welcomeUser(agent){
        return new Promise(resolve => {
            userDB.once('value',snapshot=>{
                resolve(snapshot);
            })
        }).then(snapshot =>{
            var id = snapshot.key
            snapshot = snapshot.val()
            snapshot.key = id;
            console.log('userlogin key:' + snapshot.key)
            const context = {
                'name': 'user', 
                'lifespan': 30, 
                'parameters': snapshot
            };
            agent.setContext(context)
            return agent.add(`Welcome back ${snapshot.name}. do you want to start your homework now?`)
        }).catch(error => {
            console.log(error)
            return agent.add(`Welcome back. do you want to start your homework now?`)
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
                speech = `Currently you have ${listOfPaper.notCompleted.length} not completed homework, they are `
                listOfPaper.notCompleted.forEach((item,index) => {
                    if((listOfPaper.notCompleted.length - 1) === index){
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
        var speech = `Hang on, searching for paper ${paperName}.`;
        return getPaper(agent, paperName).
        then(paperparam => {
            if(paperparam === false){       
                return agent.add(speech + ` Sorry, I couldn't find paper ${paperName} . Please try again.`);
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
        beginQuestion(agent)
    }

    function beginQuestion(agent) {
        var questionNumber = param.questionNumber;
        var paperName = param.paperName;
        if(questionNumber === ""){
            questionNumber = 1;
        }
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
                checkAnswerContext.score = checkAnswerContext.score + currentQuestion.marks;
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
                return agent.add(speech + formQuestion(checkAnswerContext.questionNumber,currentQuestion));
            });
        }else{
            updatePaperProperties(paper.key,checkAnswerContext.score,paper.attempts + 1);
            return agent.add("Answer correct! Reach the end of paper, you have score " + checkAnswerContext.score + " marks out of " +paper.totalScore);
        }
    }

    function checkStudentAnswerNext(agent){
        var paper = agent.getContext('paper').parameters;
        var paperQuestions = paper.questions;
        var answer = param.inputAnswer;
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
        agent.add(speech);
    }

    function replyMessage(agent){
        agent.clearContext('paper');
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
            'recipientName': recipient.name,
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
        return agent.add('Ok, message sent.')
    }

    function defaultFallback(agent){
        agent.add('fall back: intent not implemented')
    }
    //============================================================================================================================================
    // GENERIC METHODS
    //============================================================================================================================================
    
    //retrieving paper details from firebase
    const getPaper = (agent, paperName) => new Promise(resolve => {
        var paperparam = false;
        homeworkDB.once('value',snapshot=>{
            snapshot.forEach(snap => {
                if(snap.val().name.includes(paperName)){
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
        return speech;
    }

    //for updating the status of each individual questions
    function updateQuestionScore(postData, paperkey, questionNumber){
        var hwref = homeworkDB.child(paperkey + "/questions/" + (questionNumber - 1));
        hwref.update(postData);
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

    agent.handleRequest(intentMap);
});
