package daggerok;

import org.springframework.boot.SpringApplication;
import org.springframework.cloud.client.SpringCloudApplication;

@SpringCloudApplication
public class TweetQueryApplication {

    public static void main(String[] args) {
        SpringApplication.run(TweetQueryApplication.class, args);
    }
}
