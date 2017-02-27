package daggerok;

import org.springframework.boot.SpringApplication;
import org.springframework.cloud.client.SpringCloudApplication;
import org.springframework.cloud.config.server.EnableConfigServer;

@EnableConfigServer
@SpringCloudApplication
public class NetflixConfigServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(NetflixConfigServerApplication.class, args);
    }
}
