package daggerok.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ReactPage {

    @GetMapping({ "/react" })
    public String redirect(Object obj) {
        return "redirect:/react/";
    }

    @GetMapping({"/react/", "/react/rx", "/react/some" })
    public String home() {
        return "/react/index.html";
    }
}
