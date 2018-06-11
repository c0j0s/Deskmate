/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const Assistant = require('actions-on-google').ApiAiAssistant;
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const know = admin.database().ref('/animal-knowledge');
const graph = know.child('graph');
const homework = admin.database().ref('/profile/0001/homework');
const questionDB = admin.database().ref('/question');

// Contexts
const WELCOME_CONTEXT = 'welcome';
const HOMEWORKSESSION_CONTEXT = 'startHomework';
const ANSWERQUESTIONCONTEXT = 'answer';

// Context Parameters
const QUESTION_ID = 'id';
const BRANCH_PARAM = 'branch';
const LEARN_THING_PARAM = 'learn-thing';
const GUESSABLE_THING_PARAM = 'guessable-thing';
const LEARN_DISCRIMINATION_PARAM = 'learn-discrimination';
const ANSWER_PARAM = 'answer';
const PAPER_PARAM = 'PaperName';

var paperQuestions;
var questionIndex = 0;
var paperResult = 0;
var currentQuestion;

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    console.log('headers: ' + JSON.stringify(request.headers));
    console.log('body: ' + JSON.stringify(request.body));

    const assistant = new Assistant({request: request, response: response});

    let actionMap = new Map();
    actionMap.set('beginHomeworkSession', startHomeworkSession);
    actionMap.set('CheckStudentAnswer', handleStudentAnswer);
    actionMap.set('moveOn', MoveOnToNextQuestion);
    actionMap.set('tryAgain', TryQuestionAgain);
    assistant.handleRequest(actionMap);

    function startHomeworkSession(assistant) {
        var paperName = assistant.getArgument(PAPER_PARAM);
        questionIndex = 0;
        const homework_ref = homework.child(paperName);
        homework_ref.once('value', snap => {
            paperQuestions = snap.val();
            questionDB.once('value', snap => {
                currentQuestion = snap.child(paperQuestions[questionIndex]).val();
                const speech = `<speak>
                                <p><s>Ok, starting paper ` + paperName + `. </s></p>
                                <break time="2s"/>
                                <p><s>Question 1: <break time="1s"/> ${currentQuestion.question}</s></p>
                                <break time="2s"/>
                                <p><s>Option 1: <break time="1s"/> ${currentQuestion.a}</s></p>
                                <p><s>Option 2: <break time="1s"/> ${currentQuestion.b}</s></p>
                                <p><s>Option 3: <break time="1s"/> ${currentQuestion.c}</s></p>
                                <p><s>Option 4: <break time="1s"/> ${currentQuestion.d}</s></p>
                                <break time="1s"/>
                                <p><s>What is your option?</s></p>
                                </speak>
                                `;
                
                const parameters = {};
                parameters["id"] = snap.key;
                parameters["answer"] = currentQuestion.answer;
                console.log(parameters);
                assistant.setContext("Question", 5, parameters);
                assistant.ask(speech);
            });
        });
    }

    function handleStudentAnswer(assistant){
        //var answerc = assistant.getContextArgument("Question", "answer").value;
        //console.log("answer"+answerc);
        var answer = assistant.getArgument(ANSWER_PARAM);
        console.log(answer);
        console.log(paperQuestions);

        var speech;
        if(answer === currentQuestion.answer.toUpperCase()){
            speech = `<speak>Correct! <break time="1s"/>`;
            paperResult = paperResult + currentQuestion.marks;
            //assistant.setContext("answerCorrect", 5);
        }else{
            speech = `<speak>Wrong! <break time="1s"/>`;
            //assistant.setContext("answerWrong", 5);
        }
        questionIndex++;
        if(questionIndex < paperQuestions.length){
            questionDB.once('value', snap => {
                currentQuestion = snap.child(paperQuestions[questionIndex]).val();
                console.log(questionIndex);
                console.log(currentQuestion.answer);
                speech = speech + "moving on to the next question. <break time='2s'/>";
                speech = speech + `<p><s>Question ${questionIndex + 1}: <break time="1s"/> ${currentQuestion.question}</s></p>
                                    <break time="2s"/>
                                    <p><s>a) <break time="1s"/> ${currentQuestion.a}</s></p>
                                    <p><s>b) <break time="1s"/> ${currentQuestion.b}</s></p>
                                    <p><s>Option 3: <break time="1s"/> ${currentQuestion.c}</s></p>
                                    <p><s>Option 4: <break time="1s"/> ${currentQuestion.d}</s></p>
                                    <break time="1s"/>
                                    <p><s>What is your option?</s></p>`;
                speech = speech + "</speak>"
                assistant.setContext("Question", 5);
                assistant.ask(speech);
            });
        }else{
            assistant.ask("<speak>you have completed this paper</speak>");
        }

    }


    function MoveOnToNextQuestion(assistant){
        console.log("Next Question")
        questionDB.once('value', snap => {
            currentQuestion = snap.child(paperQuestions[questionIndex]).val();
            const speech = `<speak>
                            <p><s>Question ${questionIndex + 1}: <break time="1s"/> ${currentQuestion.question}</s></p>
                            <break time="2s"/>
                            <p><s>Option 1: <break time="1s"/> ${currentQuestion.a}</s></p>
                            <p><s>Option 2: <break time="1s"/> ${currentQuestion.b}</s></p>
                            <p><s>Option 3: <break time="1s"/> ${currentQuestion.c}</s></p>
                            <p><s>Option 4: <break time="1s"/> ${currentQuestion.d}</s></p>
                            <break time="1s"/>
                            <p><s>What is your option?</s></p>
                            </speak>
                            `;
            
            assistant.setContext("answerQuestion", 5);
            assistant.ask(speech);
        });
    }

    function TryQuestionAgain(assistant){
        console.log("Try again")
        const speech = `<speak>What is you new answer?</speak>`;
        assistant.setContext("answerQuestion", 5);
        assistant.ask(speech);
    }
});
