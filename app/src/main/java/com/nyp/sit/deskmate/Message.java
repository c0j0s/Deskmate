package com.nyp.sit.deskmate;

public class Message {
    private String text;
    private int fromUser = 0;

    public Message(String text, int fromUser) {
        this.text = text;
        this.fromUser = fromUser;
    }

    public String getText() {
        return text;
    }

    public int fromUser() {
        return fromUser;
    }
}