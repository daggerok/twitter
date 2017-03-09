package daggerok;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SseMvcBackpreasureApplication {

    /**
     * 1. start app
     *
     * 2. in terminal 1 run:
     * $ curl localhost:8080/api/sse/mvc/files/test-spring-mvc-sse
     *
     * 3. in terminal 2:
     *
     * $ cd ~/Desktop/in
     * $ touch file-1
     * $ touch file-2
     *
     * 4. verify terminal 1 has emitting events:
     *
     * data:/path/to/Desktop/in/file-1
     * data:/path/to/Desktop/in/file-2
     */

    public static void main(String[] args) {
        SpringApplication.run(SseMvcBackpreasureApplication.class, args);
    }
}
