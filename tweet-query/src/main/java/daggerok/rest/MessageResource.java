package daggerok.rest;

import daggerok.config.ProducerConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.stream.annotation.Output;
import org.springframework.cloud.stream.messaging.Source;
import org.springframework.integration.support.MessageBuilder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import static java.lang.String.format;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@RestController
@RequiredArgsConstructor
public class MessageResource {

    final ProducerConfig.TwitterSender twitterSender;

    @Output(Source.OUTPUT)
    @PostMapping(path = "/api/messages", consumes = APPLICATION_JSON_VALUE)
    public void sendMessage(@RequestBody final String payload) {

        twitterSender.send(MessageBuilder.withPayload(format("%d: %s", System.currentTimeMillis(), payload))
                                   .build());
    }
}
