package daggerok.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.dsl.IntegrationFlows;
import org.springframework.integration.dsl.channel.MessageChannels;
import org.springframework.integration.file.dsl.Files;
import org.springframework.messaging.SubscribableChannel;

import java.io.File;

@Slf4j
@Configuration
public class ReactiveIntegrationFlowConfig {

    /**
     * each web reactive client will subscribe to that channel using http
     */
    @Bean
    SubscribableChannel subscribableChannel() {
        return MessageChannels.publishSubscribe().get();
    }

    /**
     * 1. setup working folder configuration or ~/Desktop/in
     * 2. create that directory if not exists
     * 3. each second
     * 4. get absolute path of file
     * 5. send it to the all subscribers of subscribableChannel
     * 6. whenever file in working directory created
     */
    @Bean
    public IntegrationFlow integrationFlow(@Value("${input-dir:file://${HOME}/Desktop/in}") File in) { // 1

        return IntegrationFlows.from(Files.inboundAdapter(in).autoCreateDirectory(true), // 2
                                     poller -> poller.poller(spec -> spec.fixedRate(1 * 1000L))) // 3
                .transform(File.class, File::getAbsolutePath) // 4
                .channel(subscribableChannel()) // 5
                .get(); // 6
    }
}
