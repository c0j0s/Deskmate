package com.nyp.sit.deskmate;

import android.app.Activity;
import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

public class MessageAdapter extends BaseAdapter {

    List<Message> messages = new ArrayList<Message>();
    Context context;

    public MessageAdapter(Context context) {
        this.context = context;
    }

    public void add(Message message) {
        this.messages.add(message);
        notifyDataSetChanged(); // to render the list we need to notify
    }

    @Override
    public int getCount() {
        return messages.size();
    }

    @Override
    public Object getItem(int i) {
        return messages.get(i);
    }

    @Override
    public long getItemId(int i) {
        return i;
    }

    // This is the backbone of the class, it handles the creation of single ListView row (chat bubble)
    @Override
    public View getView(int i, View convertView, ViewGroup viewGroup) {
        LayoutInflater messageInflater = (LayoutInflater) context.getSystemService(Activity.LAYOUT_INFLATER_SERVICE);
        Message message = messages.get(i);
        TextView messageBody;

        if (message.fromUser() == 1) {
            convertView = messageInflater.inflate(R.layout.user_message, null);
            messageBody = convertView.findViewById(R.id.message_body);
            messageBody.setText(message.getText());
        } else {
            convertView = messageInflater.inflate(R.layout.nlu_message, null);
            messageBody = convertView.findViewById(R.id.message_body);
            messageBody.setText(message.getText());
        }

        return convertView;
    }

}
