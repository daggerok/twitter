package daggerok.rest;

import lombok.RequiredArgsConstructor;
import lombok.val;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sse/mvc")
public class SseMvcRestController {

    final Map<String, SseEmitter> sseEmitters;

    @GetMapping("/files/{name}")
    public SseEmitter subscribe(@PathVariable("name") final String name) {

        val sseEmitter = new SseEmitter(60 * 1000L);

        return sseEmitters.put(name, sseEmitter);
    }
}
