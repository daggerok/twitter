package daggerok;

import org.springframework.boot.SpringApplication;
import org.springframework.cloud.client.SpringCloudApplication;

@SpringCloudApplication
public class TweetClientApplication {

    public static void main(String[] args) {
        SpringApplication.run(TweetClientApplication.class, args);
    }
}
