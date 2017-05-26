package daggerok.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.dsl.IntegrationFlows;
import org.springframework.integration.dsl.file.Files;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Configuration
public class SseMvcIntegrationFlowConfig {

  @Bean
  public Map<String, SseEmitter> sseEmitters() {
    return new ConcurrentHashMap<>();
  }

  @Bean
  public IntegrationFlow integrationFlow(@Value("${input-dir:file://${HOME}/Desktop/in}") File in) {
    return IntegrationFlows.from(Files.inboundAdapter(in).autoCreateDirectory(true),
                                 poller -> poller.poller(spec -> spec.fixedRate(1 * 1000L)))
                           .transform(File.class, File::getAbsolutePath)
                           .handle((path, map) -> {

                             sseEmitters().forEach((String name, SseEmitter sseEmitter) -> {
                               try {

                                 sseEmitter.send(path);

                               } catch (IOException e) {

                                 log.error("sse emitter error {}", e.getMessage(), e);
                                 throw new RuntimeException(e);
                               }
                             });

                             return null;

                           }).get();
  }
}
