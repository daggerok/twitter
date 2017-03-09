package daggerok.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.SubscribableChannel;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.FluxSink;

import static org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sse/webflux")
public class ReactiveRestController {

    final SubscribableChannel subscribableChannel;

    @GetMapping(path = "/files/{name}", produces = TEXT_EVENT_STREAM_VALUE)
    public Flux<String> subscribe(@PathVariable("name") final String name) {

        return Flux.create(sink -> {

            final FluxSink<String> serialize = sink.serialize();
            final MessageHandler messageHandler = message -> sink.next(String.class.cast(message.getPayload()));

            serialize.setCancellation(() -> subscribableChannel.unsubscribe(messageHandler));
            subscribableChannel.subscribe(messageHandler);
        });
    }
}
