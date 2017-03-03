package daggerok;

import org.springframework.boot.SpringApplication;
import org.springframework.cloud.client.SpringCloudApplication;

@SpringCloudApplication
public class TweetWriterApplication {

    public static void main(String[] args) {
        SpringApplication.run(TweetWriterApplication.class, args);
    }
}
