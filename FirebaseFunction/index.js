'use strict';

const {dialogflow} = require('actions-on-google');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const homework = admin.database().ref('/profile/0001/homework');
const questionDB = admin.database().ref('/question');

const app = dialogflow({debug: false});

const WELCOME_INTENT = 'Default Welcome Intent';
const FALLBACK_INTENT = 'Default Fallback Intent';
const BEGIN_HOMEWORK_INTENT = 'Begin Homework Session';
const BEGIN_QUESTION_INTENT = 'Begin Question';
const CHECK_ANSWER_INTENT = 'Check Student Answer';
const ASK_ANYTHING_INTENT = 'Ask Anything';


app.intent(BEGIN_HOMEWORK_INTENT, (conv, {paperName}) => {
    conv.data.paperName = paperName;
    conv.ask(`<speak>Hang on, searching for paper ${paperName}!<break time="2s"/></speak>`);
    return getPaper(conv,paperName).
    then(currentPaperName => {
        console.log("paper name:" + currentPaperName)
        if(currentPaperName === false){
            return conv.ask(`Sorry, I couldn't find paper ${paperName} . Please try again.`);
        }else{
            conv.data.score = 0;
            return conv.ask(`<speak>Ok, found ${currentPaperName}. <break time="1s"/> Would you like to start on question 1?</speak>`);
        }
    })
});

app.intent(BEGIN_QUESTION_INTENT, (conv, {questionNumber}) => {
    if(questionNumber === ""){
        questionNumber = 1;
    }
    conv.data.questionNumber = questionNumber;
    return getFBQuestions(conv, questionNumber)
    .then(currentQuestion => {
        if(currentQuestion === false){
            return conv.ask(`Sorry, I couldn't find question ${questionNumber} . Please try again.`);
        }else{
            conv.data.questionTryCount = 0;
            conv.data.preQuestionNumber = 0;
            return conv.ask(formQuestion(questionNumber,currentQuestion));
        }
    }).catch(error => {
        return conv.close(error);
    });
});

const getPaper = (conv,paperName) => new Promise(resolve => {
    var paper = false;
    homework.once('value',snapshot=>{
        snapshot.forEach(snap => {
            console.log(snap.val().name)
            console.log(paperName)
            if(snap.val().name.includes(paperName)){
                var hwref = homework.child(snap.key).toString();
                conv.data.currentPaperRef = hwref.replace('https://deskmate2018.firebaseio.com', '');
                conv.data.currentPaper = snap;
                conv.data.paperName = snap.val().name;
                console.log("paper found !");
                paper = snap.val().name;
            }
        })
        console.log(paper)
        resolve(paper);
    })
});

const getFBQuestions = (conv, questionNumber) => new Promise(
    resolve => {
        var paper = conv.data.currentPaper;
        var paperQuestions = paper.questions;
        if(questionNumber <= Object.keys(paperQuestions).length){
            return questionDB.once('value', snap => {
                var currentQuestion = snap.child(paperQuestions[questionNumber-1].id).val();
                conv.data.currentQuestion = currentQuestion;
                resolve(currentQuestion);
            });
        }else{
            return resolve(false);
        }
    }
);

const getQuestionsOnly = (conv,paperQuestions, questionNumber) => new Promise(
    resolve => {
        questionDB.once('value', snap => {
            var currentQuestion = snap.child(paperQuestions[questionNumber-1].id).val();
            conv.data.currentQuestion = currentQuestion;
            resolve(currentQuestion);
        });
    }
);


function formQuestion(questionNumber,currentQuestion) {
    const speech = `<speak>
    <p><s>Question ${questionNumber}: <break time="1s"/> ${currentQuestion.question}</s></p>
    <break time="1s"/>
    <p><s>Option 1: <break time="1s"/> ${currentQuestion.a}</s></p>
    <p><s>Option 2: <break time="1s"/> ${currentQuestion.b}</s></p>
    <p><s>Option 3: <break time="1s"/> ${currentQuestion.c}</s></p>
    <p><s>Option 4: <break time="1s"/> ${currentQuestion.d}</s></p>
    <break time="1s"/>
    <p><s>What is your option?</s></p>
    </speak>
    `;
    return speech;
}

app.intent(CHECK_ANSWER_INTENT, (conv, {answer}) => {
    var speech, postData;
    var currentQuestion = conv.data.currentQuestion;
    conv.data.preQuestionNumber = conv.data.questionNumber;
    if(answer === currentQuestion.answer.toUpperCase()){
        speech = `<speak>Answer correct! <break time="1s"/> Moving on to the next question</speak>`;
        conv.data.questionAnswerStatus = "correct";

        if(conv.data.questionTryCount === 0){
            conv.data.score = conv.data.score + currentQuestion.marks;
        }

        conv.data.questionNumber++;
    }else{
        speech = `<speak>Answer incorrect! <break time="1s"/> try again?</speak>`;
        conv.data.questionAnswerStatus  = "wrong";
    }

    var questionNumber = conv.data.questionNumber;   
    var paperQuestions = conv.data.currentPaper.questions;
    
    if(questionNumber === conv.data.preQuestionNumber){
        conv.data.questionTryCount++;
    }

    postData = {
        status: conv.data.questionAnswerStatus,
        stuAns: answer,
        tryCount: conv.data.questionTryCount
    }
    updateQuestionScore(conv,postData,conv.data.preQuestionNumber);

    if(questionNumber <= Object.keys(paperQuestions).length){
        if(conv.data.questionAnswerStatus === "correct"){
            conv.data.questionTryCount = 0;
        }
        return getFBQuestions(conv, questionNumber)
        .then(currentQuestion => {
            conv.ask(speech);
            return conv.ask(formQuestion(questionNumber,currentQuestion));
        });
    }else{
        updatePaperProperties(conv,conv.data.score);
        return conv.close("Reach the end of paper");
    }
});  

function updateQuestionScore(conv,postData,questionNumber){
    var hwref = admin.database().ref(conv.data.currentPaperRef).child("questions/" + (questionNumber - 1));
    hwref.update(postData);
}
function updatePaperProperties(conv,score){
    admin.database().ref(conv.data.currentPaperRef).update({
        score: score,
        attempts: 2,
        status: "completed"
    })
}

app.intent(ASK_ANYTHING_INTENT, (conv, {Keyword}) => {

});

app.fallback((conv) => {
    const intent = conv.intent;
    // intent contains the name of the intent
    // you defined in the Intents area of Dialogflow
    
    switch (intent) {
        case WELCOME_INTENT:{
            conv.ask('Sorry, i didnt get that, please try again;');
            break;
        }
        
        case BEGIN_HOMEWORK_INTENT:{
            const paperName = conv.arguments.get("paperName");
            conv.ask(`I didn't get that`);
            break;
        }
        
        // case BEGIN_QUESTION_INTENT:
        // break;
        
        // case CHECK_ANSWER_INTENT:
        // break;
    }
});

app.intent(FALLBACK_INTENT, (conv) => {
    conv.data.fallbackCount++;
    // Provide two prompts before ending game
    if (conv.data.fallbackCount === 1) {
        conv.contexts.set(DONE_YES_NO_CONTEXT, 5);
        conv.ask('Are you done playing Number Genie?');
    } else {
        conv.close(`Since I'm still having trouble, so I'll stop here. ` +
        `Let’s play again soon.`);
    }
});

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);
