package daggerok.config;

import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.messaging.Source;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.Gateway;
import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.messaging.Message;

@Configuration
@EnableBinding(Source.class)
public class ProducerConfig {

    @MessagingGateway
    public interface TwitterSender {

        @Gateway(requestChannel = Source.OUTPUT)
        void send(Message<String> message);
    }
}
