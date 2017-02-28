package daggerok.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import lombok.val;
import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.messaging.Source;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.support.MessageBuilder;
import org.springframework.messaging.MessageChannel;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import static java.lang.String.format;

@Slf4j
@Configuration
@RestController
@RequiredArgsConstructor
@EnableBinding(Source.class)
public class TweetProducerConfig {

    final MessageChannel output;

    @PostMapping
    public void sendMessage(@RequestBody final String payload) {

        val message = MessageBuilder.withPayload(format("%d: %s", System.currentTimeMillis(), payload))
                                    .build();

        log.info("sending message: {}", message);
        output.send(message);
    }
}
