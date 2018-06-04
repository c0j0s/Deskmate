package com.nyp.sit.deskmate;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Environment;
import android.os.Message;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;

import com.google.gson.JsonArray;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import ai.api.AIConfiguration;
import ai.api.AIDataService;
import ai.api.AIServiceException;
import ai.api.model.AIRequest;
import ai.api.model.AIResponse;
import ai.api.model.Fulfillment;
import ai.api.model.Result;
import ai.kitt.snowboy.SnowboyDetect;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

import static java.lang.Boolean.TRUE;

public class MainActivity extends AppCompatActivity {
    // View Variables
    private Button button;
    private TextView textView;
    private ListView messagesView;
    private MessageAdapter messageAdapter;

    // ASR Variables
    private SpeechRecognizer speechRecognizer;

    // TTS Variables
    private TextToSpeech textToSpeech;

    // NLU Variables
    private AIDataService aiDataService;

    // Hotword Variables detect toggle
    private boolean shouldDetect;
    private SnowboyDetect snowboyDetect;


    static {
        //Run only on amd device, Not Intel based Emulator
        System.loadLibrary("snowboy-detect-android");
    }


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

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

    private void setupViews() {
        // TODO: Setup Views
        textView = findViewById(R.id.tv_status);
        button = findViewById(R.id.btn_start_asr);
        messageAdapter = new MessageAdapter(this);
        messagesView = (ListView) findViewById(R.id.messages_view);
        messagesView.setAdapter(messageAdapter);

        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                shouldDetect = false;
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

    // xiao bai Asr setting
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
                Log.e("asr", "Errors" + Integer.toString(error));
                textView.setText("Errors" + Integer.toString(error));
                startHotword();
            }

            //ON RESULT RECEIVE
            @Override
            public void onResults(Bundle results) {
                textView.setText("Thinking");
                //Result return as List object
                List<String> texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);

                //Check if result list is empty
                if (texts == null || texts.isEmpty()){
                    //ask for retry
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

    private void startAsr() {
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

    private void setupTts() {
        // TODO: Setup TTS
        // language configuration to set after initialisation
        textToSpeech = new TextToSpeech(this, null);
    }

    private void startTts(String text) {
        // TODO: Start TTS
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
                startHotword();
            }
        };
        Threadings.runInBackgroundThread(runnable);
    }

    private void setupNlu() {
        // TODO: Change Client Access Token
        String clientAccessToken = "6e799814649e490d9f0b3bd839c05a49";
        AIConfiguration aiConfiguration = new AIConfiguration(clientAccessToken,
                AIConfiguration.SupportedLanguages.English);
        aiDataService = new AIDataService(aiConfiguration);
    }

    private void startNlu(final String text) {
        // TODO: Start NLU
        Runnable runnable = new Runnable() {
            @Override
            public void run() {
                AIRequest aiRequest = new AIRequest();
                aiRequest.setQuery(text);

                try {
                    AIResponse aiResponse = aiDataService.request(aiRequest);
                    Result result = aiResponse.getResult();
                    Fulfillment fulfillment =  result.getFulfillment();
                    String speech = fulfillment.getSpeech();

                    final com.nyp.sit.deskmate.Message message = new com.nyp.sit.deskmate.Message(speech,0);
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            messageAdapter.add(message);
                            messagesView.setSelection(messagesView.getCount() - 1);
                        }
                    });

                    startTts(speech);
                } catch (AIServiceException e) {
                    e.printStackTrace();
                }
            }
        };
        Threadings.runInBackgroundThread(runnable);
    }

    private void setupHotword() {
        shouldDetect = false;
        SnowboyUtils.copyAssets(this);

        // TODO: Setup Model File
        File snowboyDirectory = SnowboyUtils.getSnowboyDirectory();
        File model = new File(snowboyDirectory, "alexa_02092017.umdl");
        File common = new File(snowboyDirectory, "common.res");

        // TODO: Set Sensitivity
        snowboyDetect = new SnowboyDetect(common.getAbsolutePath(), model.getAbsolutePath());
        snowboyDetect.setSensitivity("0.60");
        snowboyDetect.applyFrontend(true);
    }

    private void startHotword() {
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
                startAsr();
            }
        };
        Threadings.runInBackgroundThread(runnable);
    }

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
