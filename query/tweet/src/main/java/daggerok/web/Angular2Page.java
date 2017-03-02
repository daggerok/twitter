package daggerok.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class Angular2Page {

    @GetMapping({"", "/"})
    public String home() {
        return "/index.html";
    }
}
