package daggerok;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ReactiveBackpreasureApplication {

    /**
     * 1. start app
     *
     * 2. in terminal 1 run:
     * $ curl localhost:8080/api/sse/webflux/files/test-spring-mvc-sse
     *
     * 3. in terminal 2:
     *
     * $ cd ~/Desktop/in
     * $ touch file-3
     * $ touch file-4
     *
     * 4. verify terminal 1 has emitting events:
     *
     * data:/path/to/Desktop/in/file-3
     * data:/path/to/Desktop/in/file-4
     */

    public static void main(String[] args) {
        SpringApplication.run(ReactiveBackpreasureApplication.class, args);
    }
}
