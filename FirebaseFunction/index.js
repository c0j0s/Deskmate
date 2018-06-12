'use strict';

const {dialogflow} = require('actions-on-google');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const homework = admin.database().ref('/profile/0001/homework');
const questionDB = admin.database().ref('/question');

const app = dialogflow({debug: false});

app.intent('Begin Homework Session', (conv, {paperName}) => {
    conv.data.paperName = paperName;
    conv.ask(`Alright, retrieving paper ${paperName}!`);
    conv.ask('<speak><break time="1s"/>Would you like to start on question 1?</speak>');
  });

app.intent('Begin Question', (conv, {questionNumber}) => {
    if(questionNumber === ""){
        questionNumber = 1;
    }
    conv.data.questionNumber = questionNumber;
    var paperName = conv.data.paperName;
    return getFBQuestions(conv,paperName, questionNumber)
    .then(currentQuestion => {
        return conv.ask(formQuestion(questionNumber,currentQuestion));
    });
});

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

const getFBQuestions = (conv,paperName, questionNumber) => new Promise(
    resolve => {
        homework.once('value',snapshot=>{
            snapshot.forEach(snap => {
                if(snap.val().name.includes(paperName)){
                    var paperQuestions = snap.val().questions;
                    conv.data.paperQuestions = paperQuestions;
                    return questionDB.once('value', snap => {
                        conv.data.qid = paperQuestions[questionNumber-1].id
                        var currentQuestion = snap.child(paperQuestions[questionNumber-1].id).val();
                        conv.data.currentQuestion = currentQuestion;
                        resolve(currentQuestion);
                    });
                }
            })
        })
    }
  );

  const getQuestionsOnly = (conv,paperQuestions, questionNumber) => new Promise(
    resolve => {
        questionDB.once('value', snap => {
            conv.data.qid = paperQuestions[questionNumber-1].id
            var currentQuestion = snap.child(paperQuestions[questionNumber-1].id).val();
            conv.data.currentQuestion = currentQuestion;
            resolve(currentQuestion);
        });
    }
  );

  const getAnswerById = (id) => new Promise(
    resolve => {
        questionDB.once('value', snap => {
            console.log("get answer for question " + id)
            console.log(snap.val())
            var answer = snap.child(id).val().answer;
            console.log("answer for question " + answer)
            resolve(answer);
        });
    }
  );

app.intent('Check Student Answer', (conv, {answer}) => {
    var speech;
    var currentQuestion = conv.data.currentQuestion;
    return getAnswerById(conv.data.qid).then(dbAnswer => {
        console.log(dbAnswer)
        if(answer === dbAnswer.toUpperCase()){
            speech = `<speak>Answer correct! <break time="1s"/> Moving on to the next question</speak>`;
            var paperResult = conv.data.paperResult;
            paperResult = paperResult + currentQuestion.marks;
            conv.data.paperResult = paperResult;  
            conv.data.questionNumber++;
        }else{
            speech = `<speak>Answer incorrect! <break time="1s"/> try again?</speak>`;
        }
        var questionNumber = conv.data.questionNumber;   
        var paperQuestionsLength = conv.data.paperQuestions.length;

        if(questionNumber <= paperQuestionsLength){
            var paperName = conv.data.paperName;
            var paperQuestions = conv.data.paperQuestions;
            return getQuestionsOnly(conv,paperQuestions, questionNumber)
            .then(currentQuestion => {
                conv.ask(speech);
                return conv.ask(formQuestion(questionNumber,currentQuestion));
            });
        }else{
            return conv.close("Reach the end of paper");
        }
    })
  });  

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);


// const Assistant = require('actions-on-google').ApiAiAssistant;
// const functions = require('firebase-functions');
// const admin = require('firebase-admin');
// admin.initializeApp(functions.config().firebase);

// const know = admin.database().ref('/animal-knowledge');
// const graph = know.child('graph');
// const homework = admin.database().ref('/profile/0001/homework');
// const questionDB = admin.database().ref('/question');

// // Contexts
// const WELCOME_CONTEXT = 'welcome';
// const HOMEWORKSESSION_CONTEXT = 'startHomework';
// const ANSWERQUESTIONCONTEXT = 'answer';

// // Context Parameters
// const QUESTION_ID = 'id';
// const BRANCH_PARAM = 'branch';
// const LEARN_THING_PARAM = 'learn-thing';
// const GUESSABLE_THING_PARAM = 'guessable-thing';
// const LEARN_DISCRIMINATION_PARAM = 'learn-discrimination';
// const ANSWER_PARAM = 'answer';
// const PAPER_PARAM = 'PaperName';

// var paperQuestions;
// var questionIndex = 0;
// var paperResult = 0;
// var currentQuestion;

// exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
//     console.log('headers: ' + JSON.stringify(request.headers));
//     console.log('body: ' + JSON.stringify(request.body));

//     const assistant = new Assistant({request: request, response: response});

//     let actionMap = new Map();
//     actionMap.set('beginHomeworkSession', startHomeworkSession);
//     actionMap.set('CheckStudentAnswer', handleStudentAnswer);
//     actionMap.set('moveOn', MoveOnToNextQuestion);
//     actionMap.set('tryAgain', TryQuestionAgain);
//     assistant.handleRequest(actionMap);

//     function startHomeworkSession(assistant) {
//         var paperName = assistant.getArgument(PAPER_PARAM);
//         questionIndex = 0;
//         const homework_ref = homework.child(paperName);
//         homework_ref.once('value', snap => {
//             paperQuestions = snap.val();
//             questionDB.once('value', snap => {
//                 currentQuestion = snap.child(paperQuestions[questionIndex]).val();
//                 const speech = `<speak>
//                                 <p><s>Ok, starting paper ` + paperName + `. </s></p>
//                                 <break time="2s"/>
//                                 <p><s>Question 1: <break time="1s"/> ${currentQuestion.question}</s></p>
//                                 <break time="2s"/>
//                                 <p><s>Option 1: <break time="1s"/> ${currentQuestion.a}</s></p>
//                                 <p><s>Option 2: <break time="1s"/> ${currentQuestion.b}</s></p>
//                                 <p><s>Option 3: <break time="1s"/> ${currentQuestion.c}</s></p>
//                                 <p><s>Option 4: <break time="1s"/> ${currentQuestion.d}</s></p>
//                                 <break time="1s"/>
//                                 <p><s>What is your option?</s></p>
//                                 </speak>
//                                 `;
                
//                 const parameters = {};
//                 parameters["id"] = snap.key;
//                 parameters["answer"] = currentQuestion.answer;
//                 console.log(parameters);
//                 assistant.setContext("Question", 5, parameters);
//                 assistant.ask(speech);
//             });
//         });
//     }

//     function handleStudentAnswer(assistant){
//         //var answerc = assistant.getContextArgument("Question", "answer").value;
//         //console.log("answer"+answerc);
//         var answer = assistant.getArgument(ANSWER_PARAM);
//         console.log(answer);
//         console.log(paperQuestions);

//         var speech;
//         if(answer === currentQuestion.answer.toUpperCase()){
//             speech = `<speak>Correct! <break time="1s"/>`;
//             paperResult = paperResult + currentQuestion.marks;
//             //assistant.setContext("answerCorrect", 5);
//         }else{
//             speech = `<speak>Wrong! <break time="1s"/>`;
//             //assistant.setContext("answerWrong", 5);
//         }
//         questionIndex++;
//         if(questionIndex < paperQuestions.length){
//             questionDB.once('value', snap => {
//                 currentQuestion = snap.child(paperQuestions[questionIndex]).val();
//                 console.log(questionIndex);
//                 console.log(currentQuestion.answer);
//                 speech = speech + "moving on to the next question. <break time='2s'/>";
//                 speech = speech + `<p><s>Question ${questionIndex + 1}: <break time="1s"/> ${currentQuestion.question}</s></p>
//                                     <break time="2s"/>
//                                     <p><s>a) <break time="1s"/> ${currentQuestion.a}</s></p>
//                                     <p><s>b) <break time="1s"/> ${currentQuestion.b}</s></p>
//                                     <p><s>Option 3: <break time="1s"/> ${currentQuestion.c}</s></p>
//                                     <p><s>Option 4: <break time="1s"/> ${currentQuestion.d}</s></p>
//                                     <break time="1s"/>
//                                     <p><s>What is your option?</s></p>`;
//                 speech = speech + "</speak>"
//                 assistant.setContext("Question", 5);
//                 assistant.ask(speech);
//             });
//         }else{
//             assistant.ask("<speak>you have completed this paper</speak>");
//         }

//     }


//     function MoveOnToNextQuestion(assistant){
//         console.log("Next Question")
//         questionDB.once('value', snap => {
//             currentQuestion = snap.child(paperQuestions[questionIndex]).val();
//             const speech = `<speak>
//                             <p><s>Question ${questionIndex + 1}: <break time="1s"/> ${currentQuestion.question}</s></p>
//                             <break time="2s"/>
//                             <p><s>Option 1: <break time="1s"/> ${currentQuestion.a}</s></p>
//                             <p><s>Option 2: <break time="1s"/> ${currentQuestion.b}</s></p>
//                             <p><s>Option 3: <break time="1s"/> ${currentQuestion.c}</s></p>
//                             <p><s>Option 4: <break time="1s"/> ${currentQuestion.d}</s></p>
//                             <break time="1s"/>
//                             <p><s>What is your option?</s></p>
//                             </speak>
//                             `;
            
//             assistant.setContext("answerQuestion", 5);
//             assistant.ask(speech);
//         });
//     }

//     function TryQuestionAgain(assistant){
//         console.log("Try again")
//         const speech = `<speak>What is you new answer?</speak>`;
//         assistant.setContext("answerQuestion", 5);
//         assistant.ask(speech);
//     }
// });
