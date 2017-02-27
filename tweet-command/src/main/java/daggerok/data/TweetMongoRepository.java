package daggerok.data;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.stream.Stream;

public interface TweetMongoRepository extends MongoRepository<Tweet, String> {

    Stream<Tweet> findAllByOrderByTimeDesc();
}
