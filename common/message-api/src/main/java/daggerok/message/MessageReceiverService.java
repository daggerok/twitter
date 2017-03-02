package daggerok.message;

import org.springframework.messaging.Message;

public interface MessageReceiverService {

    void recive(final Message<String> message);
}
