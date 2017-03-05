package daggerok.data;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.stream.Stream;

@Repository
public interface TweetMongoRepository extends MongoRepository<Tweet, String> {

    Stream<Tweet> findAllByOrderByTimeDesc();
}
