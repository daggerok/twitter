package daggerok.config;

import daggerok.data.Tweet;
import daggerok.data.TweetMongoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.messaging.Sink;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;

@Configuration
@RequiredArgsConstructor
@EnableBinding(Sink.class)
public class TweetCommandConfig {

    final TweetMongoRepository tweetMongoRepository;

    @ServiceActivator(inputChannel = Sink.INPUT)
    public void send(final String payload) {

        tweetMongoRepository.save(Tweet.of(payload));
//        return MessageBuilder
//                .withPayload(format("hi!, %d", System.currentTimeMillis()))
//                .build();
    }
}
