package daggerok.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.experimental.Accessors;
import org.springframework.data.annotation.Id;

import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;

import static java.time.LocalDateTime.now;

@Data
@Accessors(chain = true)
@RequiredArgsConstructor(staticName = "of")
@JsonIgnoreProperties(ignoreUnknown = true)
public class Tweet {

  @NotNull
  final String message;
  @Id
  String id;
  LocalDateTime time = now();
}
