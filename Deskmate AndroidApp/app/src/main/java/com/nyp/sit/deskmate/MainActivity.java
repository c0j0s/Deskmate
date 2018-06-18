package com.nyp.sit.deskmate;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.AsyncTask;
import android.os.Bundle;
import android.os.StrictMode;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.support.v7.app.AppCompatActivity;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;

import com.google.gson.JsonElement;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;

import ai.api.AIDataService;
import ai.api.AIServiceException;
import ai.api.android.AIConfiguration;
import ai.api.model.AIRequest;
import ai.api.model.AIResponse;
import ai.api.model.Fulfillment;
import ai.api.model.Result;
import ai.kitt.snowboy.SnowboyDetect;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

public class MainActivity extends AppCompatActivity {
    // View Variables
    private Button startAsrButton;
    private TextView textView;
    private ListView messagesView;
    private MessageAdapter messageAdapter;

    // ASR Variables
    private SpeechRecognizer speechRecognizer;

    // TTS Variables
    private TextToSpeech textToSpeech;

    // NLU Variables
    private AIDataService aiDataService;
    private AsyncTask<AIRequest, Void, AIResponse> asyncTask;

    // Hotword Variables detect toggle
    private boolean shouldDetect;
    private boolean asrStart = false;
    private boolean keepSession = false;
    private SnowboyDetect snowboyDetect;


    static {
        //Run only on amd device, Not Intel based Emulator
        System.loadLibrary("snowboy-detect-android");
    }


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        StrictMode.ThreadPolicy policy = new StrictMode.ThreadPolicy.Builder().permitAll().build();
        StrictMode.setThreadPolicy(policy);

        // TODO: Setup Components
        setupViews();
        setupXiaoBaiButton();
        setupTts();
        setupAsr();
        setupNlu();
        setupHotword();
        // TODO: Start Hotword
        startHotword();
    }

//    @Override
//    protected void onPause() {
//        super.onPause();
//        try {
//            speechRecognizer.cancel();
//            speechRecognizer.stopListening();
//            asyncTask.cancel(true);
//            textToSpeech.stop();
//        }catch (Exception e){
//
//        }
//    }
//
//    @Override
//    protected void onResume() {
//        super.onResume();
//        shouldDetect = true;
//        startHotword();
//    }

    /*==============================================================================================
        Setting up
     */

    // setup views
    private void setupViews() {
        // TODO: Setup Views
        textView = findViewById(R.id.tv_status);
        startAsrButton = findViewById(R.id.btn_start_asr);

        messageAdapter = new MessageAdapter(this);
        messagesView = findViewById(R.id.messages_view);
        messagesView.setAdapter(messageAdapter);

        startAsrButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (!asrStart) {
                    toggleButton(true);
                    startAsr();
                }else{
                    toggleButton(false);
                    try {
                        speechRecognizer.cancel();
                        speechRecognizer.stopListening();
                        asyncTask.cancel(true);
                        textToSpeech.stop();
                    }catch (Exception e){

                    }
                    new Timer().schedule(
                            new TimerTask() {
                                @Override
                                public void run() {
                                    startHotword();
                                }
                            },
                            500
                    );
                }
            }
        });

    }
    private void toggleButton(final boolean listening){
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
            if (listening) {
                asrStart = true;
                shouldDetect = false;
                startAsrButton.setText("Cancel");
            }else{
                shouldDetect = true;
                asrStart = false;
                startAsrButton.setText("Listen");
            }
            }
        });
    }

    // xiao bai button onclick action -> start broadcast intent
    private void setupXiaoBaiButton() {
        String BUTTON_ACTION = "com.gowild.action.clickDown_action";

        IntentFilter intentFilter = new IntentFilter();
        intentFilter.addAction(BUTTON_ACTION);

        BroadcastReceiver broadcastReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                // TODO: Add action to do after button press is detected
                shouldDetect = false;
            }
        };
        registerReceiver(broadcastReceiver, intentFilter);
    }

    // setup hotword
    private void setupHotword() {
        shouldDetect = false;
        SnowboyUtils.copyAssets(this);

        // TODO: Setup Model File
        File snowboyDirectory = SnowboyUtils.getSnowboyDirectory();
        File model = new File(snowboyDirectory, "alexa_02092017.umdl");
        File common = new File(snowboyDirectory, "common.res");

        // TODO: Set Sensitivity
        snowboyDetect = new SnowboyDetect(common.getAbsolutePath(), model.getAbsolutePath());
        snowboyDetect.setSensitivity("0.30");
        snowboyDetect.applyFrontend(true);
    }

    // hotword trigger asr
    private void setupAsr() {
        // TODO: Setup ASR
        // init speechRecogniser
        speechRecognizer = speechRecognizer.createSpeechRecognizer(this);

        // init listener states
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {

            }

            @Override
            public void onBeginningOfSpeech() {

            }

            //ON VOLUME CHANGE
            @Override
            public void onRmsChanged(float rmsdB) {

            }

            //VOICE DATA RECEIVE
            @Override
            public void onBufferReceived(byte[] buffer) {

            }

            //ON SPEECH END
            @Override
            public void onEndOfSpeech() {

            }

            //ON ERROR OCCUR
            @Override
            public void onError(int error) {
                /*
                4: network error
                7: No recognition
                8: busy
                 */
                Log.e("asr", "Errors" + Integer.toString(error));
                textView.setText("Errors" + Integer.toString(error));
                keepSession = false;
                if (error == 7) {
                    startTts("Can't recognise what you said");
                }else if(error == 4){
                    //startTts("Network Error! Please try again");
                    final com.nyp.sit.deskmate.Message message = new com.nyp.sit.deskmate.Message("Network Error! Please try again",0);
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            messageAdapter.add(message);
                            messagesView.setSelection(messagesView.getCount() - 1);
                        }
                    });
                }else if(error == 5){
                    //on cancel
                }else{
                    textView.setText("Please try again");
                    startTts("Please try again");
                }
                asrStart = false;
                toggleButton(false);
            }

            //ON RESULT RECEIVE
            @Override
            public void onResults(Bundle results) {
                //Result return as List object
                List<String> texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);

                //Check if result list is empty
                if (texts == null || texts.isEmpty()){
                    //ask for retry
                    keepSession = true;
                    textView.setText("Please try again");
                }else{
                    String text = texts.get(0);
                    final com.nyp.sit.deskmate.Message message = new com.nyp.sit.deskmate.Message(text,1);
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            messageAdapter.add(message);
                            messagesView.setSelection(messagesView.getCount() - 1);
                        }
                    });
                    startNlu(text);
                }
            }

            @Override
            public void onPartialResults(Bundle partialResults) {

            }

            @Override
            public void onEvent(int eventType, Bundle params) {

            }
        });
    }

    // asr link to nlu and trigger tts
    private void setupNlu() {
        // TODO: Change Client Access Token
        //String clientAccessToken = "4c166b1b0569439e82c9bf8bd60ee69b";
        String clientAccessToken = "bc35556fc5c44261a4828d8c301b619e";
        AIConfiguration aiConfiguration = new AIConfiguration(clientAccessToken,
                AIConfiguration.SupportedLanguages.English,
                AIConfiguration.RecognitionEngine.System);
        aiDataService = new AIDataService(aiConfiguration);

    }

    //tts speaks nlu result
    private void setupTts() {
        // TODO: Setup TTS
        // language configuration to set after initialisation
        textToSpeech = new TextToSpeech(this, null);
    }

    /*==============================================================================================
        Interaction Methods
     */

    private void startHotword() {

        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                toggleButton(false);
                textView.setText("Listening for Alexa");
            }
        });

        Runnable runnable = new Runnable() {
            @Override
            public void run() {
                shouldDetect = true;
                android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO);

                int bufferSize = 3200;
                byte[] audioBuffer = new byte[bufferSize];
                AudioRecord audioRecord = new AudioRecord(
                        MediaRecorder.AudioSource.DEFAULT,
                        16000,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        bufferSize
                );

                if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    Log.e("hotword", "audio record fail to initialize");
                    return;
                }

                audioRecord.startRecording();
                Log.d("hotword", "start listening to hotword");

                while (shouldDetect) {
                    audioRecord.read(audioBuffer, 0, audioBuffer.length);

                    short[] shortArray = new short[audioBuffer.length / 2];
                    ByteBuffer.wrap(audioBuffer).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(shortArray);

                    int result = snowboyDetect.runDetection(shortArray, shortArray.length);
                    if (result > 0) {
                        Log.d("hotword", "detected");
                        shouldDetect = false;
                    }
                }

                audioRecord.stop();
                audioRecord.release();
                Log.d("hotword", "stop listening to hotword");

                // TODO: Add action after hotword is detected
                if (!asrStart) {
                    startAsr();
                }
            }
        };
        Threadings.runInBackgroundThread(runnable);
    }

    private void startAsr() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                toggleButton(true);
                textView.setText("Listening to you");
            }
        });

        Runnable runnable = new Runnable() {
            @Override
            public void run() {
                // TODO: Set Language
                final Intent recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en");
                recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en");
                recognizerIntent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
                recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_WEB_SEARCH);
                recognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);

                // Stop hotword detection in case it is still running
                shouldDetect = false;

                // TODO: Start ASR
                speechRecognizer.startListening(recognizerIntent);

            }
        };

        Threadings.runInMainThread(this, runnable);
    }

    private void startNlu(final String text) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                textView.setText("Processing what you said");
            }
        });

        asyncTask = new AsyncTask<AIRequest, Void, AIResponse>() {
            @Override
            protected AIResponse doInBackground(AIRequest... requests) {
                final AIRequest aiRequest = new AIRequest(text);
                try {
                    final AIResponse response = aiDataService.request(aiRequest);
                    return response;
                } catch (AIServiceException e) {
                    e.printStackTrace();
                }
                return null;
            }
            @Override
            protected void onPostExecute(AIResponse aiResponse) {
                if (aiResponse != null) {
                    // process aiResponse here
                    Result result = aiResponse.getResult();
                    Log.e("DM", result.toString());
                    Fulfillment fulfillment = result.getFulfillment();
                    Log.e("DM", result.getFulfillment().getMessages().get(0).toString());
                    String speech = fulfillment.getSpeech();
                    Log.e("DM", speech);
                    if (speech.equalsIgnoreCase("end_session")) {
                        keepSession = false;
                        startTts("OK, wake me again if you need me.");
                    } else if (speech.substring(0, 15).equalsIgnoreCase("search_function")) { 
                        Log.e("Speech", speech.substring(16));
                        String searchSpeech = getSearch(speech.substring(16));
                        startTts(searchSpeech);
                    } else {
                        keepSession = true;
                        startTts(speech);
                    }
                }
            }

        };

        asyncTask.execute();

//        // TODO: Start NLU
//        Runnable runnable = new Runnable() {
//            @Override
//            public void run() {
//                AIRequest aiRequest = new AIRequest();
//                aiRequest.setQuery(text);
//
//                try {
//                    AIResponse aiResponse = aiDataService.request(aiRequest);
//                    Log.e("deskmate",aiResponse.toString());
//                    Result result = aiResponse.getResult();
//                    Log.e("deskmate",result.toString());
//                    Fulfillment fulfillment = result.getFulfillment();
//                    //Log.e("deskmate",result.getFulfillment().toString());
//                    String speech = "test";//fulfillment.getSpeech();
//                    //Log.e("deskmate",result.getFulfillment().getData().toString());
//
//
//                    if (speech.equalsIgnoreCase("end_session")) {
//                        keepSession = false;
//                        startTts("OK, wake me again if you need me.");
//                    } else {
//                        keepSession = true;
//                        startTts(speech);
//                    }
//
//                } catch (AIServiceException e) {
//                    e.printStackTrace();
//                }
//            }
//        };
//        Threadings.runInBackgroundThread(runnable);
    }

    private void startTts(String text) {
        final com.nyp.sit.deskmate.Message message = new com.nyp.sit.deskmate.Message(text,0);
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                messageAdapter.add(message);
                messagesView.setSelection(messagesView.getCount() - 1);
                textView.setText("Replying");
            }
        });
        // TODO: Start TTS
        textToSpeech.setPitch(1);
        textToSpeech.setSpeechRate(1);
        textToSpeech.setLanguage(Locale.ENGLISH);
        textToSpeech.speak(text, textToSpeech.QUEUE_FLUSH,null);
        // TODO: Wait for end and start hotword
        Runnable runnable = new Runnable() {
            @Override
            public void run() {
                while (textToSpeech.isSpeaking()) {
                    try {
                        Thread.sleep(100);
                    } catch (InterruptedException e) {
                        Log.e("tts", e.getMessage(), e);
                    }
                }
                shallContinueConversation();
            }
        };
        Threadings.runInBackgroundThread(runnable);
    }

    /*==============================================================================================
        Other Methods
     */

    private void shallContinueConversation(){
        //if keep session, continue asr, else wait 5s and end session, start hotword detection
        if(keepSession){
            startAsr();
        }else{
            //ending session
            startHotword();
        }
    }

    private String getSearch(String userInput) {    //Added this for search

        //        String searchInput = userInput.replaceAll(" ", "%20");
                String searchInput = userInput.replaceAll(" ", "_");
                Log.e("Search Input", searchInput);
        
        //        String URL = "https://www.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=" + searchInput;
        //        String URL = "http://www.answers.com/Q/" + searchInput;
                String URL = "http://qa.answers.com/Q/" + searchInput;
        
                Element txt;
                String result;
                Document doc = null;
                try {
                    doc = Jsoup.connect(URL).get();
        
                    try {
                        txt = doc.select("div.answer_text").first();
                        Log.e("txt", txt.toString());
                        result = txt.toString().trim().replaceAll("<div class=\"answer_text\">", "")
                                .replaceAll( "</div>", "").replaceAll("<b>", "")
                                .replaceAll("</b>", "").replaceAll( "<i>", "")
                                .replaceAll("</i>", "").replaceAll("<br>", "")
                                .replaceAll("<li>", "").replaceAll("</li>", "")
                                .replaceAll("<ol>", "").replaceAll("</ol>", "")
                                .replaceAll("<ul>", "").replaceAll("</ul>", "")
                                .replaceAll("<a>", "").replaceAll("</a>", "")
                                .replaceAll("-&gt;", " ").replaceAll("&nbsp;", "")
                                .replaceAll( "\\+\\+\\+", "").replaceAll("\\s+", " ");

                    }catch(Exception e) {
                        result = "Unable to search. Please rephrase your question. For example: What is, Where does, Which is.";
                    }
        
                    return  result;
        
                } catch (IOException e) {
                    e.printStackTrace();
                }
        
        //       WIKI Version
        
        //        HttpURLConnection httpcon;
        //        try {
        //            httpcon = (HttpURLConnection) new URL(URL).openConnection();
        //            httpcon.addRequestProperty("User-Agent", "Mozilla/5.0");
        //
        //            BufferedReader in = new BufferedReader(new InputStreamReader(httpcon.getInputStream()));
        //
        //            String responseSB;
        //            String result;
        //            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
        //                responseSB = in.lines().collect(Collectors.joining());
        //                in.close();
        //
        //                try {
        //                    result = "Search found! " + responseSB.split("extract\":\"")[1];
        //
        //                } catch (Exception e) {
        //                    Log.e("Error", e.toString());
        //                    result = "Unable to search. Please rephrase your question.";
        //                }
        //
        //                Log.e("Result: ", result);
        //
        //            } else {
        //                result = "Unable to search. Please use android version 7.0(Nougat) and up.";
        //            }
        //
        //            String textToTell = result.length() > 270 ? result.substring(0, 270) : result;
        //            Log.e("Reply Speech", textToTell);
        //
        //            return textToTell;
        //
        //        } catch (IOException e) {
        //            e.printStackTrace();
        //        }
                return "No search found!";
        }


//            new Timer().schedule(
//                    new TimerTask() {
//                        @Override
//                        public void run() {
//
//                        }
//                    },
//                    5000
//            );

//    private String getWeather() {
//        // TODO: (Optional) Get Weather Data via REST API
//        //return "No weather info";
//        //api.data.gov.sg/v1/environment/2-hour-weather-forecast
//        OkHttpClient client = new OkHttpClient();
//        Request request = new Request.Builder()
//                .url("https://api.data.gov.sg/v1/environment/2-hour-weather-forecast")
//                .addHeader("accept", "application/json")
//                .build();
//
//        try {
//            Response response = client.newCall(request).execute();
//            String reponsetx = response.body().toString();
//
//            JSONObject jsonobj = new JSONObject(reponsetx);
//            JSONArray fc = jsonobj.getJSONArray("name")
//                    .getJSONObject(0)
//                    .getJSONArray("forecast");
//
//            for (int i = 0; i < fc.length(); i++) {
//                JSONObject obj = fc.getJSONObject(i);
//                String area = obj.getString("name");
//                if (area.equalsIgnoreCase("Ang Mo Kio")) {
//                    return obj.getString("forecast");
//                }
//            }
//
//        } catch (IOException e) {
//            e.printStackTrace();
//        } catch (JSONException e) {
//            e.printStackTrace();
//        }
//        return "No weather info";
//    }


}
