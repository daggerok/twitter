package daggerok.data;

import daggerok.SpringApplicationTest;
import lombok.Cleanup;
import lombok.val;
import org.junit.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import static java.util.stream.Collectors.toList;
import static org.hamcrest.core.Is.is;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThat;

public class TweetMongoRepositoryTest extends SpringApplicationTest {

  @Autowired
  private TweetMongoRepository tweetMongoRepository;

  @Test
  public void contextLoads() {
    assertNotNull("tweetMongoRepository is null.", tweetMongoRepository);
  }

  @Test
  public void findAllByOrderByTimeDescTest() throws Exception {

    tweetMongoRepository.deleteAll();

    Stream.of("message 1", "message 2")
          .map(Tweet::of)
          .forEach(tweetMongoRepository::save);

    TimeUnit.SECONDS.sleep(1);

    @Cleanup val stream = tweetMongoRepository.findAllByOrderByTimeDesc();
    val tweets = stream.collect(toList());

    assertThat("should be 2 messages", tweets.size(), is(2));

    val first = tweets.get(0);
    val second = tweets.get(0);

    assertThat("first message should not be older than next",
               first.getTime().isBefore(second.getTime()), is(false));
  }
}
