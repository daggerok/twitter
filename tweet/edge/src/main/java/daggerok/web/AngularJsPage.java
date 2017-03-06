package daggerok.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/angularjs")
public class AngularJsPage {

    @GetMapping
    public String redirect(Object obj) {
        return "redirect:/angularjs/";
    }

    @GetMapping({ "/" })
    public String home() {
        return "/angularjs/index.html";
    }
}
