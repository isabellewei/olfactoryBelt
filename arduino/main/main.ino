char Incoming_value = 0;                //Variable for storing Incoming_value
void setup() 
{
  Serial.begin(9600);         //Sets the data rate in bits per second (baud) for serial data transmission
  pinMode(13, OUTPUT);
  pinMode(12, OUTPUT);
  pinMode(11, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(9, OUTPUT);
}
void loop()
{
//  digitalWrite(13, HIGH);
//  digitalWrite(12, HIGH);
//  digitalWrite(11, HIGH);
//  digitalWrite(10, HIGH);
//  digitalWrite(9, HIGH);
  if(Serial.available() > 0)  
  {
    Incoming_value = Serial.read();      //Read the incoming data and store it into variable Incoming_value
    Serial.println(Incoming_value);        //Print Value of Incoming_value in Serial monitor
    if(Incoming_value == 'd'){            
      digitalWrite(13, HIGH);  
      delay(4000);
      digitalWrite(13, LOW);  
    }
    else if(Incoming_value == 't'){            
      digitalWrite(12, HIGH);  
      delay(4000);
      digitalWrite(12, LOW);  
    }
    else if(Incoming_value == 'g'){            
      digitalWrite(11, HIGH);  
      delay(4000);
      digitalWrite(11, LOW);  
    }
    else if(Incoming_value == 'a'){            
      digitalWrite(10, HIGH);  
      delay(4000);
      digitalWrite(10, LOW);  
    }
    else if(Incoming_value == 'b'){            
      digitalWrite(9, HIGH);  
      delay(4000);
      digitalWrite(9, LOW);  
    }
  }
 
}            
