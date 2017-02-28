package daggerok.config;

import daggerok.TweetDataConfig;
import daggerok.data.Tweet;
import daggerok.data.TweetMongoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.annotation.StreamListener;
import org.springframework.cloud.stream.messaging.Sink;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.Message;

@Slf4j
@Configuration
@RequiredArgsConstructor
@EnableBinding(Sink.class)
@Import(TweetDataConfig.class)
public class TweetConsumerConfig {

    final TweetMongoRepository tweetMongoRepository;

    @StreamListener(Sink.INPUT)
    public void tweetReceiver(final Message<String> message) {

        log.info("received: {}", message);
        tweetMongoRepository.save(Tweet.of(message.getPayload()));
    }
}