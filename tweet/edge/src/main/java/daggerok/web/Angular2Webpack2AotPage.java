package daggerok.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/angular2-webpack2-aot")
public class Angular2Webpack2AotPage {

  @GetMapping
  public String redirect(Object obj) {
    return "redirect:/angular2-webpack2-aot/";
  }

  @GetMapping({ "/", "/message", "/message/" })
  public String home() {
    return "/angular2-webpack2-aot/index.html";
  }
}
