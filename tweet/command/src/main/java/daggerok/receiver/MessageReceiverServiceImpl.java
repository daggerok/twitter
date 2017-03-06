package daggerok.receiver;

import daggerok.data.Tweet;
import daggerok.data.TweetMongoRepository;
import daggerok.message.MessageReceiverService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.stream.annotation.StreamListener;
import org.springframework.cloud.stream.messaging.Sink;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageReceiverServiceImpl implements MessageReceiverService {

    final TweetMongoRepository tweetMongoRepository;

    @Override
    @StreamListener(Sink.INPUT)
    public void receive(Message<String> message) {

        log.info("received: {}", message);
        tweetMongoRepository.save(Tweet.of(message.getPayload()));
    }
}
