use serde::{Deserialize};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)] 
#[serde(rename_all = "PascalCase")]
pub enum ImageCoverType {
   Artist,
   Album,
}