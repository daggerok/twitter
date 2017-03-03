package daggerok.config;

import daggerok.TweetDataConfig;
import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.messaging.Sink;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;


@Configuration
@EnableBinding(Sink.class)
@Import(TweetDataConfig.class)
public class ConsumerConfig {}
