package daggerok;

import org.springframework.boot.SpringApplication;
import org.springframework.cloud.client.SpringCloudApplication;
import org.springframework.cloud.netflix.zuul.EnableZuulProxy;

@EnableZuulProxy
@SpringCloudApplication
public class TweetEdgeWebClientApplication {

    public static void main(String[] args) {
        SpringApplication.run(TweetEdgeWebClientApplication.class, args);
    }
}
