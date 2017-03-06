package daggerok.rest;

import daggerok.config.ProducerConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.FluxSource;
import reactor.core.publisher.Mono;

import java.util.stream.Stream;

@RestController
public class MessageEndpoint {

    @Autowired
    ProducerConfig.TwitterSender twitterSender;

    @PostMapping("/")
    public void post() {
        twitterSender.send(
                MessageBuilder.withPayload("hey!")
                              .build());
    }

    @GetMapping("/mono")
    public Mono<String> mono() {
        return Mono.justOrEmpty("test");
    }

    @GetMapping("/flux")
    public Flux<String> flux() {
        return FluxSource.fromStream(
                Stream.of("one", "two", "three", "two", "one"));
    }
}
