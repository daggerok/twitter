package daggerok;

import org.springframework.boot.SpringApplication;
import org.springframework.cloud.client.SpringCloudApplication;

@SpringCloudApplication
public class TweetCommandApplication {

    public static void main(String[] args) {
        SpringApplication.run(TweetCommandApplication.class, args);
    }
}
