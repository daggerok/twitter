package daggerok.message;

import org.springframework.messaging.Message;

public interface MessageReceiverService {

    void receive(final Message<String> message);
}
