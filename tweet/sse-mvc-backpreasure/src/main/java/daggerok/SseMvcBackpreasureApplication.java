package daggerok;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SseMvcBackpreasureApplication {

  /**
   * 1. start app
   * <p>
   * 2. in terminal 1 run:
   * $ curl localhost:8080/api/sse/mvc/files/test-spring-mvc-sse
   * <p>
   * 3. in terminal 2:
   * <p>
   * $ cd ~/Desktop/in
   * $ touch file-1
   * $ touch file-2
   * <p>
   * 4. verify terminal 1 has emitting events:
   * <p>
   * data:/path/to/Desktop/in/file-1
   * data:/path/to/Desktop/in/file-2
   */

  public static void main(String[] args) {
    SpringApplication.run(SseMvcBackpreasureApplication.class, args);
  }
}
