package daggerok.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.annotation.Output;
import org.springframework.cloud.stream.messaging.Source;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.Gateway;
import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.integration.support.MessageBuilder;
import org.springframework.messaging.Message;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import static java.lang.String.format;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Slf4j
@Configuration
@RestController
@RequiredArgsConstructor
@EnableBinding(Source.class)
public class TweetProducerConfig {

    final TwitterSender twitterSender;

    @Output(Source.OUTPUT)
    @PostMapping(path = "/api/messages", consumes = APPLICATION_JSON_VALUE)
    public void sendMessage(@RequestBody final String payload) {

        val message = MessageBuilder.withPayload(format("%d: %s", System.currentTimeMillis(), payload))
                                    .build();

        log.info("sending message: {}", message);
        twitterSender.send(message);
    }
}

@MessagingGateway
interface TwitterSender {

    @Gateway(requestChannel = Source.OUTPUT)
    void send(Message message);
}
